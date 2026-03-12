import { AsyncLocalStorage } from "async_hooks";

/** Context stored per-request for audit trail and logging. */
export interface RequestContext {
  /** The authenticated user's ID, or null for unauthenticated requests. */
  readonly actorId: string | null;
  /** Unique request ID for correlation across logs and services. */
  readonly requestId: string;
}

/**
 * AsyncLocalStorage instance for propagating request-scoped context.
 * Used by the audit middleware to capture the current actor without explicit passing.
 */
export const asyncContext = new AsyncLocalStorage<RequestContext>();

/**
 * Retrieves the current request context from AsyncLocalStorage.
 * Returns a default context if none is set (e.g., in background jobs).
 */
export function getCurrentContext(): RequestContext {
  return asyncContext.getStore() ?? { actorId: null, requestId: "system" };
}
