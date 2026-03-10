import { z } from 'zod';
export const requestDomainSchema = z.object({
  subdomain: z.string()
    .min(3, 'Subdomain must be at least 3 characters')
    .max(63, 'Subdomain must not exceed 63 characters')
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'Subdomain must be lowercase alphanumeric and hyphens only, not starting or ending with a hyphen'),
});
export type RequestDomainDto = z.infer<typeof requestDomainSchema>;
