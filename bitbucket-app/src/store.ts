import { kvs } from '@forge/kvs';

/** Connection to TraceGuard for Jira: its trace-lookup web trigger URL and the shared secret. */
export interface Connection {
  url: string;
  secret: string;
}

const URL_KEY = 'jira-webtrigger-url';
const SECRET_KEY = 'jira-webtrigger-secret';
const CONNECTED_AT = 'jira-connected-at';

/** Forge web trigger host (urlFormat v2). Must match permissions.external.fetch in manifest.yml. */
const ALLOWED_HOST = /^[a-z0-9-]+\.webtrigger\.atlassian\.app$/;

export function validateConnection(url: string, secret: string): Connection {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error('The URL is not valid. Copy it from TraceGuard setup in Jira.');
  }
  if (parsed.protocol !== 'https:' || !ALLOWED_HOST.test(parsed.hostname)) {
    throw new Error('The URL must be a Forge web trigger URL (https://….webtrigger.atlassian.app/…).');
  }
  if (!/^tgs_[0-9a-f]{64}$/.test(secret.trim())) throw new Error('The secret must start with tgs_. Copy it from TraceGuard setup in Jira.');
  return { url: parsed.toString(), secret: secret.trim() };
}

export async function getConnection(): Promise<Connection | undefined> {
  const [url, secret] = await Promise.all([kvs.get<string>(URL_KEY), kvs.getSecret<string>(SECRET_KEY)]);
  return url && secret ? { url, secret } : undefined;
}

export async function saveConnection(c: Connection): Promise<void> {
  await kvs.setSecret(SECRET_KEY, c.secret);
  await kvs.set(URL_KEY, c.url);
  await kvs.set(CONNECTED_AT, new Date().toISOString());
}

export async function connectionStatus(): Promise<{ connected: boolean; host?: string; connectedAt?: string }> {
  const [url, secret, connectedAt] = await Promise.all([
    kvs.get<string>(URL_KEY),
    kvs.getSecret<string>(SECRET_KEY),
    kvs.get<string>(CONNECTED_AT),
  ]);
  return { connected: Boolean(url && secret), host: url ? new URL(url).hostname : undefined, connectedAt };
}
