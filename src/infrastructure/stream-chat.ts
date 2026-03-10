import { StreamChat } from 'stream-chat';
import type { AppConfig } from '../config/index.js';

/**
 * Creates a GetStream Chat server client.
 * Used for managing chat channels and generating user tokens.
 */
export function createStreamChatClient(config: AppConfig): StreamChat {
  return StreamChat.getInstance(config.GETSTREAM_API_KEY, config.GETSTREAM_API_SECRET);
}
