import Resolver from '@forge/resolver';
import { route, webTrigger } from '@forge/api';
import { jira } from '../adapters/jira';
import { seedDemoProject } from '../adapters/seed';
import { newSecret } from '../adapters/signature';
import { setBitbucketSecret } from '../adapters/store';
import { getTestCandidates, linkTestCase, QuickFixError } from './quickfix';
import { checkChangeImpact, generateEvidencePack, getOverview, getSetupInfo, getTrace, type ActionPayload } from './actions';

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

const QUICK_FIX_MODULES = new Set(['traceguard-chain', 'traceguard-matrix']);
const MAX_INPUT = 200;

function textInput(payload: unknown, name: string, required = true): string | undefined {
  const raw = (payload as Record<string, unknown> | undefined)?.[name];
  if (raw === undefined || raw === null || raw === '') {
    if (required) throw new QuickFixError(`Input "${name}" is required.`);
    return undefined;
  }
  if (typeof raw !== 'string' || raw.length > MAX_INPUT) throw new QuickFixError(`Input "${name}" is invalid.`);
  return raw.trim();
}

async function quickFix<T>(context: unknown, body: (ctx: ResolverContext) => Promise<T>) {
  const ctx = context as ResolverContext;
  if (!ctx.moduleKey || !QUICK_FIX_MODULES.has(ctx.moduleKey) || !ctx.accountId) {
    return { error: 'Quick fixes are only available in Jira.' };
  }
  try {
    return await body(ctx);
  } catch (err) {
    if (err instanceof QuickFixError) return { error: err.message };
    console.error('TraceGuard quick fix failed', err);
    return { error: 'TraceGuard could not update Jira. Check the app logs.' };
  }
}

resolver.define('getTestCandidates', ({ payload, context }) =>
  quickFix(context, () => getTestCandidates(textInput(payload, 'requirementId')!, textInput(payload, 'release', false))),
);

/** Quick fix for G2: links a Test Case to the requirement with "verifies". */
resolver.define('linkTestCase', ({ payload, context }) =>
  quickFix(context, (ctx) => linkTestCase(ctx.accountId!, textInput(payload, 'requirementId')!, textInput(payload, 'testKey')!)),
);

/** Publishes the evidence pack of the selected release from the Jira project page. */
resolver.define('publishEvidencePack', ({ payload, context }) => {
  const ctx = context as ResolverContext;
  if (ctx.moduleKey !== 'traceguard-matrix' || !ctx.accountId) return { error: 'Publish from the TraceGuard project page.' };
  return generateEvidencePack(payloadOf(payload, ctx, ['release']));
});

/**
 * Creates (or rotates) the shared secret for the TraceGuard Bitbucket app and returns it with the
 * web trigger URL. The secret is shown once; rotating it disconnects the old Bitbucket configuration.
 */
resolver.define('connectBitbucket', async ({ context }) => {
  const ctx = context as ResolverContext;
  if (ctx.moduleKey !== SETUP_MODULE || !ctx.accountId) return { error: 'Bitbucket can only be connected from TraceGuard setup.' };
  try {
    if (!(await isJiraAdmin(ctx.accountId))) return { error: 'Only Jira administrators can connect Bitbucket.' };
    const url = await webTrigger.getUrl('trace-lookup');
    const secret = newSecret();
    await setBitbucketSecret(secret);
    return { summary: 'Paste both values into TraceGuard for Bitbucket (workspace settings).', url, secret };
  } catch (err) {
    console.error('TraceGuard connectBitbucket failed', err);
    return { error: 'Could not create the Bitbucket connection. Check the app logs.' };
  }
});

export const handler = resolver.getDefinitions();
