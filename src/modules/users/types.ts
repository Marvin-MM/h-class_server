/** Types specific to the Users module. */

/** User profile response shape. */
export interface UserProfileResponse {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly role: string;
  readonly avatarUrl: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
