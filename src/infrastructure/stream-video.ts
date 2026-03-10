import { StreamClient } from '@stream-io/node-sdk';
import type { AppConfig } from '../config/index.js';

/**
 * Creates a GetStream Video server client.
 * Used for managing video calls and generating join tokens.
 */
export function createStreamVideoClient(config: AppConfig): StreamClient {
  return new StreamClient(config.GETSTREAM_API_KEY, config.GETSTREAM_API_SECRET);
}
