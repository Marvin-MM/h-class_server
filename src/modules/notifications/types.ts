export interface NotificationResponse {
  readonly id: string;
  readonly userId: string;
  readonly title: string;
  readonly message: string;
  readonly read: boolean;
  readonly createdAt: Date;
}
