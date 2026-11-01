import { useEffect, useState, type ReactNode } from 'react';
import { mount } from './mount';
import { getContext, useRemote } from './bridge';
import { ClassBadge, ErrorState, GapList, Key, Loading, Shell, SimulatedNote } from './components';
import type { TraceView } from './types';

type Chain = TraceView['chains'][number];

const DEMO_KEYS = ['REQ-112', 'REQ-115', 'REQ-118'];

function Step({ label, state, children }: { label: string; state: 'ok' | 'gap' | 'empty'; children: ReactNode }) {
  return (
    <li className={`step step--${state}`}>
      <span className="step__dot" aria-hidden="true" />
      <div>
        <p className="step__label">{label}</p>
        <div className="step__body">{children}</div>
      </div>
    </li>
  );
}

function ChainCard({ chain, release }: { chain: Chain; release: string }) {
  const { requirement: req, gaps } = chain;
  const has = (...codes: string[]) => gaps.some((g) => codes.includes(g.code));
  return (
    <article className="chain">
      <header className="chain__head">
        <Key>{req.id}</Key>
        <ClassBadge value={req.safetyClass} />
        <span className="chain__title">{req.title}</span>
      </header>
      <ol className="steps">
        <Step label="Requirement" state={has('G6') ? 'gap' : 'ok'}>
          {req.status === 'approved' ? 'Approved' : 'Draft'}
          {req.approvedAt && <span className="muted"> · {req.approvedAt.slice(0, 10)}</span>}
        </Step>
        <Step label="Hazards" state={chain.hazards.length ? 'ok' : 'empty'}>
          {chain.hazards.length
            ? chain.hazards.map((h) => (
                <p key={h.id}>
                  <Key>{h.id}</Key> {h.title} <span className="muted">({h.severity})</span>
                </p>
              ))
            : 'None linked'}
        </Step>
        <Step label="Work items" state={has('G1') || chain.workItems.length === 0 ? 'gap' : 'ok'}>
          {chain.workItems.length
            ? chain.workItems.map((w) => (
                <p key={w.key}>
                  <Key>{w.key}</Key> {w.title}
                  {w.assignee && <span className="muted"> · {w.assignee}</span>}
                </p>
              ))
            : 'No story or task'}
        </Step>
        <Step label="Code changes" state={chain.pullRequests.length ? 'ok' : 'empty'}>
          {chain.pullRequests.length
            ? chain.pullRequests.map((p) => (
                <p key={p.id}>
                  <Key>{p.id}</Key> {p.title}
                  <span className="muted"> · {p.mergedAt ? `merged ${p.mergedAt.slice(0, 10)}` : 'open'}</span>
                </p>
              ))
            : 'None yet'}
        </Step>
        <Step label="Tests" state={has('G2', 'G3', 'G5') || chain.testCases.length === 0 ? 'gap' : 'ok'}>
          {chain.testCases.length
            ? chain.testCases.map((t) => (
                <p key={t.key}>
                  <Key>{t.key}</Key> {t.title}{' '}
                  <span className={`result result--${t.lastRun?.result ?? 'none'}`}>{t.lastRun?.result ?? 'not run'}</span>
                </p>
              ))
            : 'No test case'}
        </Step>
        <Step label="Releases" state={chain.releases.length ? 'ok' : 'empty'}>
          {chain.releases.join(', ') || 'Not scheduled'}
        </Step>
      </ol>
      {gaps.length > 0 && (
        <div className="chain__gaps">
          <p className="chain__gapsTitle">Open gaps in release {release}</p>
          <GapList gaps={gaps} />
        </div>
      )}
    </article>
  );
}

function App() {
  const [issueKey, setIssueKey] = useState<string>();
  const [key, setKey] = useState<string>();
  const [draft, setDraft] = useState('');
  useEffect(() => {
    void getContext().then((c) => setIssueKey(c.extension?.issue?.key));
  }, []);

  const trace = useRemote<TraceView>('getTrace', key ? { key } : {}, [key]);
  const data = trace.data;
  const lookingAt = key ?? issueKey;

  return (
    <Shell compact>
      {trace.loading && !data && <Loading />}
      {trace.error && <ErrorState message={trace.error} onRetry={trace.reload} />}
      {data && (
        <>
          <SimulatedNote show={data.simulated} />
          {data.chains.length === 0 ? (
            <div className="untraced">
              <p className="untraced__title">
                {lookingAt ? <Key>{lookingAt}</Key> : 'This issue'} is not traced to a requirement.
              </p>
              <p className="muted">
                Link it to a requirement in the SRS, or explore the demo trace below.
              </p>
            </div>
          ) : (
            data.chains.map((c) => <ChainCard key={c.requirement.id} chain={c} release={data.release} />)
          )}
          <form
            className="lookup"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) setKey(draft.trim());
            }}
          >
            <label htmlFor="lookup-key" className="lookup__label">
              Trace another key
            </label>
            <div className="lookup__row">
              <input
                id="lookup-key"
                className="input"
                value={draft}
                maxLength={200}
                placeholder="REQ-112, an issue key, or PR-57"
                onChange={(e) => setDraft(e.target.value)}
              />
              <button type="submit" className="btn">
                Trace
              </button>
            </div>
            <div className="chips">
              {DEMO_KEYS.map((k) => (
                <button key={k} type="button" className="chip" aria-pressed={key === k} onClick={() => setKey(k)}>
                  {k}
                </button>
              ))}
              {key && issueKey && (
                <button type="button" className="chip chip--ghost" onClick={() => setKey(undefined)}>
                  Back to {issueKey}
                </button>
              )}
            </div>
          </form>
        </>
      )}
    </Shell>
  );
}

mount(<App />);
