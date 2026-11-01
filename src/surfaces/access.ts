import { userCanReadContent } from '../adapters/confluence';
import { userHasProjectPermissions } from '../adapters/jira';
import type { TraceSource } from '../adapters/source';

/**
 * TraceGuard reads Jira and Confluence as the app, so every surface that shows live data checks the
 * calling user's own permissions first. The built-in sample holds no customer data and stays open.
 */
export class AccessError extends Error {}

/** Forge passes the invocation context (with the calling user) as the second handler argument. */
export type InvocationContext = { principal?: { accountId?: string }; accountId?: string } | undefined;

/**
 * The calling user. Only the Forge invocation context (Rovo, MCP) or the resolver context (UI) is trusted;
 * action inputs are never used, so a caller cannot claim another user's identity.
 */
export function accountOf(context: InvocationContext): string | undefined {
  const id = context?.principal?.accountId ?? context?.accountId;
  return typeof id === 'string' && id ? id : undefined;
}

const UNKNOWN_USER = 'TraceGuard could not identify you, so it cannot check your Jira permissions.';

/** Throws unless the user may browse the Jira project the live data comes from. */
export async function assertCanBrowse(src: TraceSource, accountId: string | undefined): Promise<void> {
  if (src.simulated) return;
  if (!accountId) throw new AccessError(UNKNOWN_USER);
  if (!src.projectId || !(await userHasProjectPermissions(accountId, src.projectId, ['BROWSE_PROJECTS']))) {
    throw new AccessError(`You need the Browse projects permission in Jira project ${src.projectKey} to see its traceability data.`);
  }
}

/** Throws unless the user can view the Confluence space (checked on its home page). */
export async function assertCanUseSpace(space: { key: string; homepageId?: string }, accountId: string | undefined): Promise<void> {
  if (!accountId) throw new AccessError(UNKNOWN_USER);
  if (!space.homepageId || !(await userCanReadContent(accountId, space.homepageId))) {
    throw new AccessError(`You cannot view Confluence space ${space.key}, so TraceGuard will not publish there.`);
  }
}
