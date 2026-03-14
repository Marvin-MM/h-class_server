/** Types specific to the Courses module. */

/** Course response shape for API. */
export interface CourseResponse {
  readonly id: string;
  readonly tutorId: string;
  readonly title: string;
  readonly description: string;
  readonly status: string;
  readonly price: string;
  readonly passMark: string;
  readonly commissionRate: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly tutor?: {
    readonly id: string;
    readonly firstName: string;
    readonly lastName: string;
  };
}


/** Enrollment response shape. */
export interface EnrollmentResponse {
  readonly id: string;
  readonly userId: string;
  readonly courseId: string;
  readonly createdAt: Date;
  readonly course?: {
    readonly title: string;
    readonly status: string;
  };
}
