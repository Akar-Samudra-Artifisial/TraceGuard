import { useMemo, useState } from 'react';
import { mount } from './mount';
import { call, useRemote } from './bridge';
import {
  ClassBadge,
  CoverageMeter,
  ErrorState,
  GapList,
  ImpactChecker,
  Key,
  Loading,
  Masthead,
  SeverityCounts,
  Shell,
  SimulatedNote,
  TraceRail,
} from './components';
import type { MatrixRow, Overview, PublishResult, Severity } from './types';

type Filter = 'all' | 'gap' | 'traced';

function MatrixTable({ rows }: { rows: MatrixRow[] }) {
  return (
    <table className="matrix">
      <thead>
        <tr>
          <th scope="col">Requirement</th>
          <th scope="col">Class</th>
          <th scope="col">Trace</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.requirementId} className={`matrix__row matrix__row--${row.status}`} style={{ animationDelay: `${i * 30}ms` }}>
            <th scope="row">
              <Key>{row.requirementId}</Key>
              <span className="matrix__title">{row.title}</span>
            </th>
            <td>
              <ClassBadge value={row.safetyClass} />
            </td>
            <td>
              <TraceRail row={row} />
            </td>
            <td>
              {row.status === 'traced' ? (
                <span className="status status--ok">Traced</span>
              ) : (
                <span className="status status--gap">{row.gaps.map((g) => g.code).join(' ')}</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PublishPack({ release }: { release: string }) {
  const [state, setState] = useState<{ busy: boolean; result?: PublishResult; error?: string }>({ busy: false });
  const publish = async () => {
    setState({ busy: true });
    try {
      setState({ busy: false, result: await call<PublishResult>('publishEvidencePack', { release }) });
    } catch (e) {
      setState({ busy: false, error: e instanceof Error ? e.message : String(e) });
    }
  };
  return (
    <div className="publish">
      <button type="button" className="btn" onClick={() => void publish()} disabled={state.busy}>
        {state.busy ? 'Publishing…' : `Publish evidence pack ${release}`}
      </button>
      {state.error && <p className="state state--error">{state.error}</p>}
      {state.result && (
        <p className="publish__done">
          Published to space {state.result.space}:{' '}
          <a href={state.result.pageUrl} target="_blank" rel="noreferrer">
            {state.result.pageTitle}
          </a>
        </p>
      )}
    </div>
  );
}

function App() {
  const [release, setRelease] = useState<string | undefined>();
  const [filter, setFilter] = useState<Filter>('all');
  const [severity, setSeverity] = useState<Severity | 'all'>('all');
  const overview = useRemote<Overview>('getOverview', release ? { release } : {}, [release]);
  const data = overview.data;

  const rows = useMemo(
    () => (data?.rows ?? []).filter((r) => filter === 'all' || r.status === filter),
    [data, filter],
  );
  const gaps = useMemo(
    () => (data?.gaps ?? []).filter((g) => severity === 'all' || g.severity === severity),
    [data, severity],
  );

  return (
    <Shell>
      <Masthead
        eyebrow="TraceGuard · audit readiness"
        title={data ? <>Release {data.release}</> : 'Traceability'}
        aside={
          data && (
            <label className="select">
              <span>Release</span>
              <select value={data.release} onChange={(e) => setRelease(e.target.value)}>
                {data.releases.map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.name}
                    {r.signedOff ? ' (signed off)' : ''}
                  </option>
                ))}
              </select>
            </label>
          )
        }
      />
      {overview.loading && !data && <Loading />}
      {overview.error && <ErrorState message={overview.error} onRetry={overview.reload} />}
      {data && (
        <>
          <SimulatedNote show={data.simulated} pullRequests={data.simulatedPullRequests} bitbucketConnected={data.bitbucketConnected} />
          <section className="hero" aria-label="Coverage">
            <CoverageMeter coverage={data.coverage} rows={data.rows} />
            <div className="hero__side">
              <p className="hero__summary">{data.summary}</p>
              <SeverityCounts gaps={data.gaps} />
              <PublishPack key={data.release} release={data.release} />
            </div>
          </section>

          <div className="layout">
            <section className="panel panel--wide" aria-labelledby="matrix-title">
              <div className="panel__bar">
                <h2 id="matrix-title" className="panel__title">
                  Traceability matrix
                </h2>
                <div className="seg" role="group" aria-label="Filter requirements">
                  {(['all', 'gap', 'traced'] as Filter[]).map((f) => (
                    <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                      {f === 'all' ? 'All' : f === 'gap' ? 'With gaps' : 'Traced'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="scroll">
                <MatrixTable rows={rows} />
              </div>
            </section>

            <section className="panel" aria-labelledby="gaps-title">
              <div className="panel__bar">
                <h2 id="gaps-title" className="panel__title">
                  Open gaps <span className="muted">{data.gaps.length}</span>
                </h2>
                <select
                  className="select--bare"
                  aria-label="Filter gaps by severity"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as Severity | 'all')}
                >
                  <option value="all">All severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <GapList gaps={gaps} empty={severity === 'all' ? undefined : `No ${severity} gaps.`} />
            </section>
          </div>

          <ImpactChecker />
        </>
      )}
    </Shell>
  );
}

mount(<App />);
