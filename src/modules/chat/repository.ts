import type { PrismaClient, Conversation, Message, ChannelType } from "@prisma/client";

export class ChatRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createConversation(data: {
    type: ChannelType;
    courseId?: string;
    participantIds: string[];
  }): Promise<Conversation> {
    return this.prisma.conversation.create({
      data: {
        type: data.type,
        ...(data.courseId ? { courseId: data.courseId } : {}),
        participants: {
          create: data.participantIds.map(id => ({ userId: id }))
        }
      },
    });
  }

  async findConversationById(id: string) {
    return this.prisma.conversation.findUnique({
      where: { id },
      include: { participants: true },
    });
  }
  
  async getUserConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId }
        }
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        participants: { select: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } },
        course: { select: { id: true, title: true } }
      }
    });
  }

  async createMessage(conversationId: string, senderId: string, content: string): Promise<Message> {
    return this.prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: { conversationId, senderId, content }
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() }
      });
      return message;
    });
  }

  async getMessages(conversationId: string, page: number, pageSize: number) {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.message.findMany({
        where: { conversationId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: { sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } }
      }),
      this.prisma.message.count({ where: { conversationId } })
    ]);
    return { data, total };
  }

  async getAdmins() {
     return this.prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
  }

  async getCourseEnrollments(courseId: string) {
     return this.prisma.enrollment.findMany({ where: { courseId }, select: { userId: true } });
  }
}
