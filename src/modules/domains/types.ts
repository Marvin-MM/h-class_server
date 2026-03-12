export interface DomainResponse {
  readonly id: string;
  readonly userId: string;
  readonly subdomain: string;
  readonly status: string;
  readonly cloudflareDnsRecordId: string | null;
  readonly createdAt: Date;
}
