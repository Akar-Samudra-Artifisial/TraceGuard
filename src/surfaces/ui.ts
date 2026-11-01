import Resolver from '@forge/resolver';
import { route } from '@forge/api';
import { jira } from '../adapters/jira';
import { seedDemoProject } from '../adapters/seed';
import { checkChangeImpact, getOverview, getSetupInfo, getTrace, type ActionPayload } from './actions';

const resolver = new Resolver();

type ResolverContext = {
  accountId?: string;
  cloudId?: string;
  moduleKey?: string;
  extension?: { issue?: { key?: string } };
};

const SETUP_MODULE = 'traceguard-setup';

/** Only forwards the inputs each view needs; the issue key always comes from Forge context, not the browser. */
function payloadOf(payload: unknown, context: ResolverContext, keys: string[]): ActionPayload {
  const input = (payload ?? {}) as Record<string, unknown>;
  const picked: ActionPayload = Object.fromEntries(keys.filter((k) => k in input).map((k) => [k, input[k]]));
  picked.context = { cloudId: context.cloudId, moduleKey: context.moduleKey, jira: { issueKey: context.extension?.issue?.key } };
  return picked;
}

async function isJiraAdmin(accountId: string): Promise<boolean> {
  const res = await jira<{ globalPermissions?: string[] }>('POST', route`/rest/api/3/permissions/check`, {
    accountId,
    globalPermissions: ['ADMINISTER'],
  });
  return (res.globalPermissions ?? []).includes('ADMINISTER');
}

resolver.define('getOverview', ({ payload, context }) => getOverview(payloadOf(payload, context, ['release'])));
resolver.define('getSetup', ({ payload, context }) => getSetupInfo(payloadOf(payload, context, [])));
resolver.define('getTrace', ({ payload, context }) => getTrace(payloadOf(payload, context, ['key', 'release'])));
resolver.define('checkImpact', ({ payload, context }) =>
  checkChangeImpact(payloadOf(payload, context, ['files', 'repo'])),
);

/** Creates the CardioSense demo project. Only from the admin page, and only for Jira admins. */
resolver.define('seedDemo', async ({ context }) => {
  const ctx = context as ResolverContext;
  if (ctx.moduleKey !== SETUP_MODULE || !ctx.accountId) return { error: 'Demo data can only be loaded from TraceGuard setup.' };
  try {
    if (!(await isJiraAdmin(ctx.accountId))) return { error: 'Only Jira administrators can load demo data.' };
    const result = await seedDemoProject(ctx.accountId);
    return { summary: `Created project ${result.projectKey} with the CardioSense demo.`, ...result };
  } catch (err) {
    console.error('TraceGuard demo seed failed', err);
    return { error: err instanceof Error ? err.message : 'Loading demo data failed. Check the app logs.' };
  }
});

export const handler = resolver.getDefinitions();
