import { mount } from './mount';
import { useRemote } from './bridge';
import { ClassBadge, CoverageMeter, ErrorState, Key, Loading, Masthead, SeverityCounts, Shell, SimulatedNote } from './components';
import type { Overview } from './types';

function App() {
  const overview = useRemote<Overview>('getOverview', {}, []);
  const data = overview.data;
  return (
    <Shell compact>
      {overview.loading && !data && <Loading />}
      {overview.error && <ErrorState message={overview.error} onRetry={overview.reload} />}
      {data && (
        <>
          <Masthead
            eyebrow="TraceGuard · live traceability"
            title={<>Release {data.release}</>}
            aside={<SeverityCounts gaps={data.gaps} />}
          />
          <CoverageMeter coverage={data.coverage} rows={data.rows} />
          <table className="matrix matrix--compact">
            <thead>
              <tr>
                <th scope="col">Requirement</th>
                <th scope="col">Class</th>
                <th scope="col">Work</th>
                <th scope="col">Tests</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.requirementId} className={`matrix__row matrix__row--${r.status}`}>
                  <th scope="row">
                    <Key>{r.requirementId}</Key>
                    <span className="matrix__title">{r.title}</span>
                  </th>
                  <td>
                    <ClassBadge value={r.safetyClass} />
                  </td>
                  <td>{r.workItems.join(', ') || '—'}</td>
                  <td>
                    {r.tests.length
                      ? r.tests.map((t) => (
                          <span key={t.key} className={`result result--${t.result}`}>
                            {t.key}
                          </span>
                        ))
                      : '—'}
                  </td>
                  <td>
                    {r.status === 'traced' ? (
                      <span className="status status--ok">Traced</span>
                    ) : (
                      <span className="status status--gap">{r.gaps.map((g) => g.code).join(' ')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.untracedChanges.length > 0 && (
            <p className="macro__foot">
              Untraced safety-critical changes:{' '}
              {data.untracedChanges.map((g) => (
                <Key key={g.id}>{g.artifactKey}</Key>
              ))}
            </p>
          )}
          <SimulatedNote show={data.simulated} pullRequests={data.simulatedPullRequests} />
        </>
      )}
    </Shell>
  );
}

mount(<App />);
