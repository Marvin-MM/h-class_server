import type {
  PrismaClient,
  TutorApplication,
  AppConfig,
  AuditLog,
  Prisma,
} from "@prisma/client";

export class AdminRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findApplications(
    status?: string,
    page = 1,
    pageSize = 20,
  ): Promise<{
    data: (TutorApplication & {
      user: { id: string; firstName: string; lastName: string; email: string };
    })[];
    total: number;
  }> {
    const where: Prisma.TutorApplicationWhereInput = status
      ? { status: status as TutorApplication["status"] }
      : {};
    const [data, total] = await this.prisma.$transaction([
      this.prisma.tutorApplication.findMany({
        where,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.tutorApplication.count({ where }),
    ]);
    return { data, total };
  }

  async findApplicationById(
    id: string,
  ): Promise<
    | (TutorApplication & {
        user: {
          id: string;
          firstName: string;
          lastName: string;
          email: string;
        };
      })
    | null
  > {
    return this.prisma.tutorApplication.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async approveApplication(
    applicationId: string,
    userId: string,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.tutorApplication.update({
        where: { id: applicationId },
        data: { status: "APPROVED" },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { role: "TUTOR" },
      }),
    ]);
  }

  async denyApplication(applicationId: string, reason: string): Promise<void> {
    await this.prisma.tutorApplication.update({
      where: { id: applicationId },
      data: { status: "DENIED", denialReason: reason },
    });
  }

  async getConfig(): Promise<AppConfig[]> {
    return this.prisma.appConfig.findMany();
  }

  async findConfigByKey(key: string): Promise<AppConfig | null> {
    return this.prisma.appConfig.findUnique({ where: { key } });
  }

  async createConfig(key: string, value: string): Promise<AppConfig> {
    return this.prisma.appConfig.create({ data: { key, value } });
  }

  async updateConfig(key: string, value: string): Promise<AppConfig> {
    return this.prisma.appConfig.update({ where: { key }, data: { value } });
  }

  async deleteConfig(key: string): Promise<void> {
    await this.prisma.appConfig.delete({ where: { key } });
  }

  async queryAuditLogs(options: {
    page: number;
    pageSize: number;
    actorId?: string;
    resourceType?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ data: AuditLog[]; total: number }> {
    const where: Prisma.AuditLogWhereInput = {
      ...(options.actorId ? { actorId: options.actorId } : {}),
      ...(options.resourceType ? { resourceType: options.resourceType } : {}),
      ...(options.action ? { action: options.action } : {}),
      ...(options.startDate || options.endDate
        ? {
            createdAt: {
              ...(options.startDate ? { gte: options.startDate } : {}),
              ...(options.endDate ? { lte: options.endDate } : {}),
            },
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        skip: (options.page - 1) * options.pageSize,
        take: options.pageSize,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, total };
  }
}
