import type { PrismaClient, Certificate, Prisma } from "@prisma/client";

export class CertificatesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: {
    studentId: string;
    courseId: string;
  }): Promise<Certificate> {
    return this.prisma.certificate.create({ data });
  }

  async findById(id: string): Promise<Certificate | null> {
    return this.prisma.certificate.findUnique({ where: { id } });
  }

  async findByStudentAndCourse(
    studentId: string,
    courseId: string,
  ): Promise<Certificate | null> {
    return this.prisma.certificate.findFirst({
      where: { studentId, courseId },
    });
  }

  async findByStudentId(studentId: string): Promise<Certificate[]> {
    return this.prisma.certificate.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
    });
  }

  async updateData(
    id: string,
    data: Prisma.InputJsonValue,
    status: "ISSUED",
  ): Promise<Certificate> {
    return this.prisma.certificate.update({
      where: { id },
      data: { data, status },
    });
  }
}
