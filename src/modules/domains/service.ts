import type { Queue } from "bullmq";
import type { DomainsRepository } from "./repository.js";
import type { DomainResponse } from "./types.js";
import { ConflictError, NotFoundError } from "../../shared/errors/index.js";
import { logger } from "../../shared/utils/logger.js";

export class DomainsService {
  constructor(
    private readonly domainsRepository: DomainsRepository,
    private readonly domainProvisioningQueue: Queue,
  ) {}

  /** Requests a subdomain. Automatically generates a unique slug based on the user's name. */
  async requestDomain(
    userId: string,
  ): Promise<DomainResponse> {
    // Check user doesn't already have an active/pending domain
    const userDomain =
      await this.domainsRepository.findActiveOrPendingByUserId(userId);
    if (userDomain)
      throw new ConflictError("You already have an active or pending domain");

    const user = await this.domainsRepository.findUserById(userId);
    if (!user) throw new NotFoundError("User", userId);

    const baseSlug = `${user.firstName}-${user.lastName}`
       .toLowerCase()
       .replace(/[^a-z0-9-]/g, "")
       .replace(/-+/g, "-")
       .replace(/^-|-$/g, "")
       .substring(0, 50);

    let subdomain = baseSlug.length >= 3 ? baseSlug : `${baseSlug}lms`;

    let isUnique = false;
    let counter = 0;

    // Evaluate against system reservations and current tenant allocations iteratively
    while (!isUnique) {
      const isReserved = await this.domainsRepository.isReserved(subdomain);
      const isTaken = await this.domainsRepository.findBySubdomain(subdomain);

      if (!isReserved && !isTaken) {
        isUnique = true;
      } else {
        counter++;
        subdomain = `${baseSlug}-${counter}`;
      }
    }

    // Create PENDING domain record
    const domain = await this.domainsRepository.create({
      userId,
      subdomain,
    });

    // Enqueue Cloudflare provisioning job
    await this.domainProvisioningQueue.add(
      "provision-domain",
      {
        domainId: domain.id,
        subdomain,
        userId,
      },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    );

    logger.info("Domain request created and provisioning queued dynamically", {
      domainId: domain.id,
      subdomain,
    });
    return this.toResponse(domain);
  }

  /** Gets the user's domain. */
  async getUserDomain(userId: string): Promise<DomainResponse | null> {
    const domain =
      await this.domainsRepository.findActiveOrPendingByUserId(userId);
    return domain ? this.toResponse(domain) : null;
  }

  private toResponse(d: {
    id: string;
    userId: string;
    subdomain: string;
    status: string;
    cloudflareDnsRecordId: string | null;
    createdAt: Date;
  }): DomainResponse {
    return {
      id: d.id,
      userId: d.userId,
      subdomain: d.subdomain,
      status: d.status,
      cloudflareDnsRecordId: d.cloudflareDnsRecordId,
      createdAt: d.createdAt,
    };
  }
}
