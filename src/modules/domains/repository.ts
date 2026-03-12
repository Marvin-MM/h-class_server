import type { PrismaClient, Domain, DomainStatus } from "@prisma/client";

export class DomainsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findBySubdomain(subdomain: string): Promise<Domain | null> {
    return this.prisma.domain.findUnique({ where: { subdomain } });
  }

  async findActiveOrPendingByUserId(userId: string): Promise<Domain | null> {
    return this.prisma.domain.findFirst({
      where: { userId, status: { in: ["ACTIVE", "PENDING"] } },
    });
  }

  async isReserved(subdomain: string): Promise<boolean> {
    const reserved = await this.prisma.reservedSubdomain.findUnique({
      where: { subdomain },
    });
    return reserved !== null;
  }

  async create(data: { userId: string; subdomain: string }): Promise<Domain> {
    return this.prisma.domain.create({ data });
  }

  async updateStatus(
    id: string,
    status: DomainStatus,
    cloudflareDnsRecordId?: string,
  ): Promise<Domain> {
    return this.prisma.domain.update({
      where: { id },
      data: {
        status,
        ...(cloudflareDnsRecordId ? { cloudflareDnsRecordId } : {}),
      },
    });
  }

  async findById(id: string): Promise<Domain | null> {
    return this.prisma.domain.findUnique({ where: { id } });
  }

  async findUserById(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }
}
