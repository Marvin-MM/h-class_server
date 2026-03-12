import type { Queue } from "bullmq";
import type { CertificatesRepository } from "./repository.js";
import type { CertificateResponse } from "./types.js";
import {
  NotFoundError,
  AuthorizationError,
} from "../../shared/errors/index.js";
import {
  eventBus,
  AppEvents,
  type CertificateEligiblePayload,
} from "../../shared/utils/event-bus.js";
import { logger } from "../../shared/utils/logger.js";

/**
 * Service handling certificate lifecycle.
 * Listens for certificate eligibility events and manages issuance via BullMQ.
 */
export class CertificatesService {
  constructor(
    private readonly certificatesRepository: CertificatesRepository,
    private readonly certificateCompilationQueue: Queue,
  ) {
    // Register event listener for certificate eligibility
    this.registerEventListeners();
  }

  /** Gets a certificate for the authenticated student. */
  async getCertificate(
    certificateId: string,
    userId: string,
  ): Promise<CertificateResponse> {
    const cert = await this.certificatesRepository.findById(certificateId);
    if (!cert) throw new NotFoundError("Certificate", certificateId);
    if (cert.studentId !== userId)
      throw new AuthorizationError("You can only view your own certificates");
    return this.toResponse(cert);
  }

  /** Gets all certificates for a student. */
  async getStudentCertificates(
    studentId: string,
  ): Promise<CertificateResponse[]> {
    const certs = await this.certificatesRepository.findByStudentId(studentId);
    return certs.map(this.toResponse);
  }

  /** Handles certificate eligibility by creating a PENDING record and enqueueing compilation. */
  async handleEligibility(payload: CertificateEligiblePayload): Promise<void> {
    const { studentId, courseId } = payload;

    // Idempotency: check if certificate already exists
    const existing = await this.certificatesRepository.findByStudentAndCourse(
      studentId,
      courseId,
    );
    if (existing) {
      logger.info("Certificate already exists for student/course", {
        studentId,
        courseId,
      });
      return;
    }

    // Create PENDING certificate record
    const cert = await this.certificatesRepository.create({
      studentId,
      courseId,
    });

    // Enqueue data compilation job
    await this.certificateCompilationQueue.add("compile-certificate", {
      certificateId: cert.id,
      studentId,
      courseId,
    });

    logger.info("Certificate record created and compilation queued", {
      certificateId: cert.id,
    });
  }

  private registerEventListeners(): void {
    eventBus.on(AppEvents.CERTIFICATE_ELIGIBLE, (payload) => {
      this.handleEligibility(payload).catch((error) => {
        logger.error("Failed to handle certificate eligibility", {
          error,
          payload,
        });
      });
    });
  }

  private toResponse(cert: {
    id: string;
    studentId: string;
    courseId: string;
    status: string;
    data: unknown;
    certificateUid: string;
    createdAt: Date;
    updatedAt: Date;
  }): CertificateResponse {
    return {
      id: cert.id,
      studentId: cert.studentId,
      courseId: cert.courseId,
      status: cert.status,
      data: cert.data as Record<string, unknown> | null,
      certificateUid: cert.certificateUid,
      createdAt: cert.createdAt,
      updatedAt: cert.updatedAt,
    };
  }
}
