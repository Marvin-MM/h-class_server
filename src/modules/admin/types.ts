/** Types for the Admin module. */
export interface ApplicationResponse {
  readonly id: string;
  readonly userId: string;
  readonly status: string;
  readonly denialReason: string | null;
  readonly createdAt: Date;
  readonly user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface AppConfigResponse {
  readonly key: string;
  readonly value: string;
  readonly updatedAt: Date;
}
