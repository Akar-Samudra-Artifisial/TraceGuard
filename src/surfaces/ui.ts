import Resolver from '@forge/resolver';
import { checkChangeImpact, getOverview, getSetupInfo, getTrace, type ActionPayload } from './actions';

const resolver = new Resolver();

type ResolverContext = { cloudId?: string; moduleKey?: string; extension?: { issue?: { key?: string } } };

/** Only forwards the inputs each view needs; the issue key always comes from Forge context, not the browser. */
function payloadOf(payload: unknown, context: ResolverContext, keys: string[]): ActionPayload {
  const input = (payload ?? {}) as Record<string, unknown>;
  const picked: ActionPayload = Object.fromEntries(keys.filter((k) => k in input).map((k) => [k, input[k]]));
  picked.context = { cloudId: context.cloudId, moduleKey: context.moduleKey, jira: { issueKey: context.extension?.issue?.key } };
  return picked;
}

resolver.define('getOverview', ({ payload, context }) => getOverview(payloadOf(payload, context, ['release'])));
resolver.define('getSetup', ({ payload, context }) => getSetupInfo(payloadOf(payload, context, [])));
resolver.define('getTrace', ({ payload, context }) => getTrace(payloadOf(payload, context, ['key', 'release'])));
resolver.define('checkImpact', ({ payload, context }) =>
  checkChangeImpact(payloadOf(payload, context, ['files', 'repo'])),
);

export const handler = resolver.getDefinitions();
