import type { PrismaClient, ChatChannel, ChannelType } from '@prisma/client';

export class ChatRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByStreamChannelId(channelId: string): Promise<ChatChannel | null> {
    return this.prisma.chatChannel.findUnique({ where: { getStreamChannelId: channelId } });
  }

  async create(data: { type: ChannelType; courseId?: string; getStreamChannelId: string }): Promise<ChatChannel> {
    return this.prisma.chatChannel.create({ data });
  }
}
