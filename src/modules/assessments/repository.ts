import type {
  PrismaClient,
  Assessment,
  Submission,
  AssessmentType,
} from "@prisma/client";

export class AssessmentsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: {
    courseId: string;
    title: string;
    type: AssessmentType;
    s3Key?: string;
  }): Promise<Assessment> {
    return this.prisma.assessment.create({ data });
  }

  async findById(id: string): Promise<Assessment | null> {
    return this.prisma.assessment.findUnique({ where: { id } });
  }

  async findByCourseId(courseId: string): Promise<Assessment[]> {
    return this.prisma.assessment.findMany({
      where: { courseId },
      orderBy: { createdAt: "asc" },
    });
  }

  /** Checks if a FINAL_ASSESSMENT already exists for a course. */
  async hasFinalAssessment(courseId: string): Promise<boolean> {
    const count = await this.prisma.assessment.count({
      where: { courseId, type: "FINAL_ASSESSMENT" },
    });
    return count > 0;
  }

  async createSubmission(data: {
    assessmentId: string;
    studentId: string;
    s3Key: string;
  }): Promise<Submission> {
    return this.prisma.submission.create({ data });
  }

  async findSubmissionById(id: string): Promise<Submission | null> {
    return this.prisma.submission.findUnique({ where: { id } });
  }

  async findSubmissionByAssessmentAndStudent(
    assessmentId: string,
    studentId: string,
  ): Promise<Submission | null> {
    return this.prisma.submission.findUnique({
      where: { assessmentId_studentId: { assessmentId, studentId } },
    });
  }

  async gradeSubmission(
    id: string,
    score: number,
    feedback?: string,
  ): Promise<Submission> {
    return this.prisma.submission.update({
      where: { id },
      data: { score, feedback, gradedAt: new Date() },
    });
  }

  /** Gets all assessments and their submissions for a student in a course. */
  async getStudentCourseSubmissions(
    courseId: string,
    studentId: string,
  ): Promise<{
    assessments: Assessment[];
    submissions: Submission[];
  }> {
    const [assessments, submissions] = await this.prisma.$transaction([
      this.prisma.assessment.findMany({ where: { courseId } }),
      this.prisma.submission.findMany({
        where: { studentId, assessment: { courseId } },
      }),
    ]);
    return { assessments, submissions };
  }

  async findSubmissionsByAssessmentId(
    assessmentId: string,
  ): Promise<Submission[]> {
    return this.prisma.submission.findMany({
      where: { assessmentId },
      orderBy: { createdAt: "desc" },
    });
  }
}
