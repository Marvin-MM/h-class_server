import type { Queue } from 'bullmq';
import type { DomainsRepository } from './repository.js';
import type { RequestDomainDto } from './dto.js';
import type { DomainResponse } from './types.js';
import { ConflictError, NotFoundError } from '../../shared/errors/index.js';
import { logger } from '../../shared/utils/logger.js';

export class DomainsService {
  constructor(
    private readonly domainsRepository: DomainsRepository,
    private readonly domainProvisioningQueue: Queue,
  ) {}

  /** Requests a subdomain. Validates uniqueness, reserved list, and single domain per user. */
  async requestDomain(userId: string, dto: RequestDomainDto): Promise<DomainResponse> {
    // Check reserved subdomains
    const isReserved = await this.domainsRepository.isReserved(dto.subdomain);
    if (isReserved) throw new ConflictError('This subdomain is reserved');

    // Check if subdomain is already taken
    const existing = await this.domainsRepository.findBySubdomain(dto.subdomain);
    if (existing) throw new ConflictError('This subdomain is already taken');

    // Check user doesn't already have an active/pending domain
    const userDomain = await this.domainsRepository.findActiveOrPendingByUserId(userId);
    if (userDomain) throw new ConflictError('You already have an active or pending domain');

    // Create PENDING domain record
    const domain = await this.domainsRepository.create({ userId, subdomain: dto.subdomain });

    // Enqueue Cloudflare provisioning job
    await this.domainProvisioningQueue.add('provision-domain', {
      domainId: domain.id,
      subdomain: dto.subdomain,
      userId,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    logger.info('Domain request created and provisioning queued', { domainId: domain.id, subdomain: dto.subdomain });
    return this.toResponse(domain);
  }

  /** Gets the user's domain. */
  async getUserDomain(userId: string): Promise<DomainResponse | null> {
    const domain = await this.domainsRepository.findActiveOrPendingByUserId(userId);
    return domain ? this.toResponse(domain) : null;
  }

  private toResponse(d: { id: string; userId: string; subdomain: string; status: string; cloudflareDnsRecordId: string | null; createdAt: Date }): DomainResponse {
    return { id: d.id, userId: d.userId, subdomain: d.subdomain, status: d.status, cloudflareDnsRecordId: d.cloudflareDnsRecordId, createdAt: d.createdAt };
  }
}
