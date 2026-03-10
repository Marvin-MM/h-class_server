import Stripe from 'stripe';
import type { AppConfig } from '../config/index.js';

/**
 * Creates and configures a Stripe API client instance.
 */
export function createStripeClient(config: AppConfig): Stripe {
  return new Stripe(config.STRIPE_SECRET_KEY, {
    typescript: true,
  });
}
