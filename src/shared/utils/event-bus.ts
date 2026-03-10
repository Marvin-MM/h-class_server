import { EventEmitter } from 'events';

/**
 * Application event names. All event names are defined as constants
 * to ensure type-safe and consistent usage across the codebase.
 */
export const AppEvents = {
  /** Fired after a new user is registered successfully. */
  USER_REGISTERED: 'user.registered',
  /** Fired after successful enrollment creation (payment confirmed). */
  ENROLLMENT_CREATED: 'enrollment.created',
  /** Fired when a session is scheduled. */
  SESSION_SCHEDULED: 'session.scheduled',
  /** Fired when a session transitions to LIVE. */
  SESSION_STARTED: 'session.started',
  /** Fired when a session transitions to ENDED. */
  SESSION_ENDED: 'session.ended',
  /** Fired when a student becomes eligible for a certificate. */
  CERTIFICATE_ELIGIBLE: 'certificate.eligible',
  /** Fired when a certificate is issued. */
  CERTIFICATE_ISSUED: 'certificate.issued',
  /** Fired when a tutor application is approved. */
  TUTOR_APPLICATION_APPROVED: 'tutor_application.approved',
  /** Fired when a tutor application is denied. */
  TUTOR_APPLICATION_DENIED: 'tutor_application.denied',
  /** Fired when domain provisioning fails. */
  DOMAIN_PROVISIONING_FAILED: 'domain.provisioning_failed',
  /** Fired when a note is created. */
  NOTE_CREATED: 'note.created',
  /** Fired when an assessment is graded. */
  ASSESSMENT_GRADED: 'assessment.graded',
} as const;

/** Union type of all event name values. */
export type AppEventName = (typeof AppEvents)[keyof typeof AppEvents];

// ─── Event Payload Interfaces ────────────────────────────────────────────────

export interface UserRegisteredPayload {
  userId: string;
  email: string;
  firstName: string;
}

export interface EnrollmentCreatedPayload {
  enrollmentId: string;
  userId: string;
  courseId: string;
  courseName: string;
}

export interface SessionScheduledPayload {
  sessionId: string;
  courseId: string;
  title: string;
  scheduledAt: Date;
  duration: number;
}

export interface SessionStateChangePayload {
  sessionId: string;
  courseId: string;
}

export interface CertificateEligiblePayload {
  studentId: string;
  courseId: string;
}

export interface CertificateIssuedPayload {
  certificateId: string;
  studentId: string;
  courseId: string;
}

export interface TutorApplicationDecisionPayload {
  applicationId: string;
  userId: string;
  email: string;
  firstName: string;
  reason?: string;
}

export interface DomainProvisioningFailedPayload {
  domainId: string;
  userId: string;
  subdomain: string;
}

export interface NoteCreatedPayload {
  noteId: string;
  courseId: string;
  title: string;
}

export interface AssessmentGradedPayload {
  submissionId: string;
  assessmentId: string;
  studentId: string;
  courseId: string;
  score: number;
}

// ─── Typed Event Map ─────────────────────────────────────────────────────────

export interface EventMap {
  [AppEvents.USER_REGISTERED]: UserRegisteredPayload;
  [AppEvents.ENROLLMENT_CREATED]: EnrollmentCreatedPayload;
  [AppEvents.SESSION_SCHEDULED]: SessionScheduledPayload;
  [AppEvents.SESSION_STARTED]: SessionStateChangePayload;
  [AppEvents.SESSION_ENDED]: SessionStateChangePayload;
  [AppEvents.CERTIFICATE_ELIGIBLE]: CertificateEligiblePayload;
  [AppEvents.CERTIFICATE_ISSUED]: CertificateIssuedPayload;
  [AppEvents.TUTOR_APPLICATION_APPROVED]: TutorApplicationDecisionPayload;
  [AppEvents.TUTOR_APPLICATION_DENIED]: TutorApplicationDecisionPayload;
  [AppEvents.DOMAIN_PROVISIONING_FAILED]: DomainProvisioningFailedPayload;
  [AppEvents.NOTE_CREATED]: NoteCreatedPayload;
  [AppEvents.ASSESSMENT_GRADED]: AssessmentGradedPayload;
}

/**
 * Typed internal event bus for inter-module communication.
 * Extends Node.js EventEmitter with strong typing for all application events.
 */
class TypedEventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  /** Emit a typed event with its payload. */
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    this.emitter.emit(event, payload);
  }

  /** Subscribe to a typed event. */
  on<K extends keyof EventMap>(event: K, listener: (payload: EventMap[K]) => void): void {
    this.emitter.on(event, listener as (...args: unknown[]) => void);
  }

  /** Subscribe to a typed event for a single invocation. */
  once<K extends keyof EventMap>(event: K, listener: (payload: EventMap[K]) => void): void {
    this.emitter.once(event, listener as (...args: unknown[]) => void);
  }

  /** Unsubscribe from a typed event. */
  off<K extends keyof EventMap>(event: K, listener: (payload: EventMap[K]) => void): void {
    this.emitter.off(event, listener as (...args: unknown[]) => void);
  }
}

/** Singleton event bus instance for the application. */
export const eventBus = new TypedEventBus();
