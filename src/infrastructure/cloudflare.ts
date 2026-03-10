import type { AppConfig } from '../config/index.js';
import { logger } from '../shared/utils/logger.js';

/**
 * Cloudflare DNS API adapter.
 * Handles subdomain provisioning via the Cloudflare REST API.
 */
export class CloudflareClient {
  private readonly apiToken: string;
  private readonly zoneId: string;
  private readonly rootDomain: string;
  private readonly baseUrl = 'https://api.cloudflare.com/client/v4';

  constructor(config: AppConfig) {
    this.apiToken = config.CLOUDFLARE_API_TOKEN;
    this.zoneId = config.CLOUDFLARE_ZONE_ID;
    this.rootDomain = config.PLATFORM_ROOT_DOMAIN;
  }

  /**
   * Creates a CNAME DNS record for a subdomain.
   * @param subdomain - The subdomain to create
   * @returns The Cloudflare DNS record ID
   */
  async createSubdomain(subdomain: string): Promise<string> {
    const url = `${this.baseUrl}/zones/${this.zoneId}/dns_records`;
    const body = {
      type: 'CNAME',
      name: `${subdomain}.${this.rootDomain}`,
      content: this.rootDomain,
      ttl: 3600,
      proxied: true,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json() as { success: boolean; result?: { id: string }; errors?: Array<{ message: string }> };

    if (!data.success || !data.result) {
      const errorMsg = data.errors?.map((e) => e.message).join(', ') ?? 'Unknown Cloudflare error';
      logger.error('Cloudflare DNS record creation failed', { subdomain, error: errorMsg });
      throw new Error(`Cloudflare API error: ${errorMsg}`);
    }

    logger.info('Cloudflare DNS record created', { subdomain, recordId: data.result.id });
    return data.result.id;
  }

  /**
   * Deletes a DNS record from Cloudflare.
   * @param recordId - The Cloudflare DNS record ID to delete
   */
  async deleteSubdomain(recordId: string): Promise<void> {
    const url = `${this.baseUrl}/zones/${this.zoneId}/dns_records/${recordId}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
      },
    });

    const data = await response.json() as { success: boolean; errors?: Array<{ message: string }> };

    if (!data.success) {
      const errorMsg = data.errors?.map((e) => e.message).join(', ') ?? 'Unknown Cloudflare error';
      logger.error('Cloudflare DNS record deletion failed', { recordId, error: errorMsg });
      throw new Error(`Cloudflare API error: ${errorMsg}`);
    }

    logger.info('Cloudflare DNS record deleted', { recordId });
  }
}
