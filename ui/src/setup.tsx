import { useEffect, useState } from 'react';
import { mount } from './mount';
import { appIdFrom, call, getContext, useRemote } from './bridge';
import { ClassBadge, ErrorState, Key, Loading, Masthead, Shell } from './components';
import type { BitbucketConnection, SeedResult, SetupInfo, SpaceResult } from './types';

const COUNT_LABEL: Record<Exclude<keyof SetupInfo['counts'], 'bitbucketPullRequests'>, string> = {
  requirements: 'Requirements',
  hazards: 'Hazards',
  workItems: 'Work items',
  testCases: 'Test cases',
  pullRequests: 'Pull requests',
};

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy">
      <code>{value}</code>
      <button
        type="button"
        className="btn"
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(
            () => setCopied(true),
            () => setCopied(false),
          );
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function LoadDemo({ reason, onDone }: { reason: string | null; onDone: () => void }) {
  const [state, setState] = useState<{ busy: boolean; result?: SeedResult; error?: string }>({ busy: false });
  const run = async () => {
    setState({ busy: true });
    try {
      const result = await call<SeedResult>('seedDemo');
      setState({ busy: false, result });
      onDone();
    } catch (e) {
      setState({ busy: false, error: e instanceof Error ? e.message : String(e) });
    }
  };
  return (
    <section className="panel seed" aria-labelledby="seed-title">
      <h2 id="seed-title" className="panel__title">
        Load demo data
      </h2>
      <p className="panel__lede">
        {reason ? `${reason} ` : ''}Creates the fictional CardioSense project <Key>CSM</Key> as real Jira issues:
        8 requirements, 3 hazards, 7 stories, 9 test cases, releases 2.2 and 2.3, and one example of every gap
        G1–G6, plus a Confluence space CSM for evidence packs when Confluence is installed. Pull requests are stored as simulated history. Takes about 20 seconds.
      </p>
      <div>
        <button type="button" className="btn btn--primary" onClick={() => void run()} disabled={state.busy}>
          {state.busy ? 'Creating project CSM…' : 'Load demo data'}
        </button>
      </div>
      {state.error && <p className="state state--error">{state.error}</p>}
      {state.result && (
        <p className="empty">
          {state.result.summary} {state.result.created.links} links created. Open project {state.result.projectKey} →
          TraceGuard tab (under More when hidden).
        </p>
      )}
    </section>
  );
}

/** Shown when the project exists but its evidence-pack space does not (Confluence added after the demo). */
function CreateSpace({ status, onDone }: { status: NonNullable<SetupInfo['confluence']>; onDone: () => void }) {
  const [state, setState] = useState<{ busy: boolean; result?: SpaceResult; error?: string }>({ busy: false });
  const run = async () => {
    setState({ busy: true });
    try {
      const result = await call<SpaceResult>('createConfluenceSpace');
      setState({ busy: false, result });
      onDone();
    } catch (e) {
      setState({ busy: false, error: e instanceof Error ? e.message : String(e) });
    }
  };
  return (
    <section className="panel seed" aria-labelledby="space-title">
      <h2 id="space-title" className="panel__title">
        Create Confluence space
      </h2>
      {status.error ? (
        <p className="state state--error">{status.error}</p>
      ) : status.available ? (
        <>
          <p className="panel__lede">
            Confluence space <Key>{status.spaceKey}</Key> does not exist yet. Publish evidence pack needs it.
          </p>
          <div>
            <button type="button" className="btn btn--primary" onClick={() => void run()} disabled={state.busy}>
              {state.busy ? `Creating space ${status.spaceKey}…` : 'Create Confluence space'}
            </button>
          </div>
        </>
      ) : (
        <p className="panel__lede">
          Confluence is not installed for TraceGuard. Add Confluence to this site, then reinstall TraceGuard from the
          install link.
        </p>
      )}
      {state.error && <p className="state state--error">{state.error}</p>}
      {state.result && <p className="empty">{state.result.summary}</p>}
    </section>
  );
}

function ConnectBitbucket({ connected, reported }: { connected: boolean; reported: number }) {
  const [state, setState] = useState<{ busy: boolean; result?: BitbucketConnection; error?: string }>({ busy: false });
  const [confirming, setConfirming] = useState(false);
  const live = connected || Boolean(state.result);
  const run = async () => {
    if (live && !confirming) return setConfirming(true);
    setConfirming(false);
    setState({ busy: true });
    try {
      setState({ busy: false, result: await call<BitbucketConnection>('connectBitbucket') });
    } catch (e) {
      setState({ busy: false, error: e instanceof Error ? e.message : String(e) });
    }
  };
  return (
    <section className="panel" aria-labelledby="bitbucket-title">
      <div className="panel__bar">
        <h2 id="bitbucket-title" className="panel__title">
          Connect Bitbucket (merge check)
        </h2>
        <span className={live ? 'status status--ok' : 'status status--demo'}>
          {live ? `Connected · ${reported} merged PR${reported === 1 ? '' : 's'} reported` : 'Not connected'}
        </span>
      </div>
      <p className="panel__lede">
        The TraceGuard for Bitbucket app blocks pull requests that change safety-critical code without a Jira issue
        traced to the affected requirement. It asks this Jira site through a signed web trigger.
      </p>
      <ol className="howto">
        <li>Install TraceGuard for Bitbucket in your workspace and turn on Custom merge checks.</li>
        <li>
          Create the connection here, then paste the URL and secret into Bitbucket → Workspace settings → TraceGuard.
          <div>
            <button type="button" className="btn" onClick={() => void run()} disabled={state.busy}>
              {state.busy ? 'Creating…' : confirming ? 'Yes, rotate now' : live ? 'Rotate secret' : 'Create connection'}
            </button>
            {confirming && (
              <span className="muted">
                {' '}
                The Bitbucket app stops passing checks until you paste the new secret.{' '}
                <button type="button" className="btn btn--link" onClick={() => setConfirming(false)}>
                  Cancel
                </button>
              </span>
            )}
          </div>
        </li>
        <li>Enable “TraceGuard trace check” for the repository and mark it Required.</li>
      </ol>
      {state.error && <p className="state state--error">{state.error}</p>}
      {state.result && (
        <div className="secret">
          <p className="muted">Copy the secret now. It is not shown again.</p>
          <CopyField value={state.result.url} />
          <CopyField value={state.result.secret} />
        </div>
      )}
    </section>
  );
}

function App() {
  const setup = useRemote<SetupInfo>('getSetup', {}, []);
  const [appId, setAppId] = useState<string>();
  useEffect(() => {
    void getContext().then((c) => setAppId(appIdFrom(c.localId)));
  }, []);
  const data = setup.data;
  const mcpUrl = `https://mcp.atlassian.com/forge/${appId ?? '<app-id>'}`;

  return (
    <Shell>
      <Masthead eyebrow="TraceGuard · setup" title="Sources and agent access" />
      {setup.loading && !data && <Loading />}
      {setup.error && <ErrorState message={setup.error} onRetry={setup.reload} />}
      {data && (
        <>
          {data.dataSource === 'demo' && <LoadDemo reason={data.fallbackReason} onDone={setup.reload} />}
          {data.confluence && !data.confluence.exists && <CreateSpace status={data.confluence} onDone={setup.reload} />}
          <section className="panel" aria-labelledby="source-title">
            <div className="panel__bar">
              <h2 id="source-title" className="panel__title">
                Data source
              </h2>
              <span className={data.dataSource === 'demo' ? 'status status--demo' : 'status status--ok'}>
                {data.dataSource === 'demo' ? 'Built-in sample' : `Live · Jira project ${data.projectKey}`}
              </span>
            </div>
            <dl className="stats">
              {(Object.keys(COUNT_LABEL) as (keyof typeof COUNT_LABEL)[]).map((k) => (
                <div key={k} className="stat">
                  <dt>{COUNT_LABEL[k]}</dt>
                  <dd>{data.counts[k]}</dd>
                </div>
              ))}
            </dl>
            <p className="muted">
              Repository <Key>{data.defaultRepo}</Key> · releases{' '}
              {data.releases.map((r) => `${r.name}${r.signedOff ? ' (signed off)' : ''}`).join(', ')}
            </p>
          </section>

          <div className="layout layout--even">
            <section className="panel" aria-labelledby="critical-title">
              <h2 id="critical-title" className="panel__title">
                Safety-critical paths
              </h2>
              <p className="panel__lede">A pull request touching these must trace to a requirement (gap G4).</p>
              <ul className="paths">
                {data.safetyCriticalPaths.map((p) => (
                  <li key={p}>
                    <code>{p}</code>
                  </li>
                ))}
              </ul>
            </section>
            <section className="panel" aria-labelledby="map-title">
              <h2 id="map-title" className="panel__title">
                Requirement → code
              </h2>
              <p className="panel__lede">From the SRS table. Used by change impact and coding agents.</p>
              <table className="map">
                <tbody>
                  {data.requirementPaths.map((r) => (
                    <tr key={r.id}>
                      <th scope="row">
                        <Key>{r.id}</Key>
                      </th>
                      <td>
                        <ClassBadge value={r.safetyClass} />
                      </td>
                      <td>
                        {r.paths.map((p) => (
                          <code key={p} className="path">
                            {p}
                          </code>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          <ConnectBitbucket connected={data.bitbucketConnected} reported={data.counts.bitbucketPullRequests} />

          <section className="panel" aria-labelledby="mcp-title">
            <h2 id="mcp-title" className="panel__title">
              Connect a coding agent (MCP)
            </h2>
            <p className="panel__lede">
              Claude Code, Cursor and other MCP clients can ask TraceGuard what a change affects before they edit
              safety-critical code.
            </p>
            <ol className="howto">
              <li>
                In Atlassian Administration → Apps → Sites → this site → <strong>Connected apps</strong> → TraceGuard,
                turn on <strong>Expose tools to MCP-compatible apps</strong>. Turn it on while TraceGuard is connected to
                Jira only, then connect Confluence.
              </li>
              <li>
                Add the remote MCP server:
                <CopyField value={mcpUrl} />
                <CopyField value={`claude mcp add --transport http traceguard ${mcpUrl}`} />
              </li>
              <li>
                Authenticate, then ask: <em>“Use check_change_impact for src/dosing/limits.ts before editing.”</em>
              </li>
            </ol>
          </section>
        </>
      )}
    </Shell>
  );
}

mount(<App />);
