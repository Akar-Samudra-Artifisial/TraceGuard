import { useState, type ReactNode } from 'react';
import { call } from './bridge';
import type { Coverage, Gap, GapCode, ImpactView, MatrixRow, SafetyClass, Severity } from './types';

export const GAP_LABEL: Record<GapCode, string> = {
  G1: 'No story or task',
  G2: 'No test case',
  G3: 'Test failing',
  G4: 'Untraced safety-critical change',
  G5: 'Tests older than the change',
  G6: 'Edited after approval',
};

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low'];

export function Shell({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return <div className={compact ? 'tg tg--compact' : 'tg'}>{children}</div>;
}

export function Masthead({ eyebrow, title, aside }: { eyebrow: string; title: ReactNode; aside?: ReactNode }) {
  return (
    <header className="masthead">
      <div>
        <p className="eyebrow">
          <Mark /> {eyebrow}
        </p>
        <h1 className="title">{title}</h1>
      </div>
      {aside && <div className="masthead__aside">{aside}</div>}
    </header>
  );
}

/** Small TraceGuard mark: a broken chain link closed by a check. */
export function Mark() {
  return (
    <svg className="mark" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 8h4M10 8h4" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}

export function SimulatedNote({
  show,
  pullRequests = false,
  bitbucketConnected = false,
}: {
  show: boolean;
  pullRequests?: boolean;
  bitbucketConnected?: boolean;
}) {
  if (show) {
    return (
      <p className="note" role="note">
        <span className="note__tag">Sample data</span>
        Showing the built-in CardioSense sample (fictional class C ECG monitor). A Jira admin can turn it into real
        Jira issues with Load demo data in TraceGuard setup.
      </p>
    );
  }
  if (!pullRequests) return null;
  if (bitbucketConnected) {
    return (
      <p className="note" role="note">
        <span className="note__tag">Live Jira</span>
        Requirements, hazards, stories and tests are read live from Jira. Bitbucket is connected: merged pull requests
        are added as they merge. Pull requests from the demo data are simulated history.
      </p>
    );
  }
  return (
    <p className="note" role="note">
      <span className="note__tag">Live Jira</span>
      Requirements, hazards, stories and tests are read live from Jira. Pull requests are simulated history until the
      TraceGuard Bitbucket app is installed.
    </p>
  );
}

export function Loading({ label = 'Reading the trace…' }: { label?: string }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state state--error" role="alert">
      <strong>TraceGuard could not load this view.</strong>
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function ClassBadge({ value }: { value: SafetyClass }) {
  return (
    <span className={`class class--${value}`} title={`IEC 62304 software safety class ${value}`}>
      {value}
    </span>
  );
}

export function SeverityTag({ value }: { value: Severity }) {
  return <span className={`sev sev--${value}`}>{value}</span>;
}

export function Key({ children }: { children: ReactNode }) {
  return <code className="key">{children}</code>;
}

/** Big percentage plus one cell per requirement, so the ratio reads at a glance. */
export function CoverageMeter({ coverage, rows }: { coverage: Coverage; rows?: MatrixRow[] }) {
  const cells = rows ?? Array.from({ length: coverage.total }, (_, i) => ({ status: i < coverage.traced ? 'traced' : 'gap' }));
  return (
    <div className="coverage">
      <div className="coverage__figure">
        <span className="coverage__pct">{coverage.percent}</span>
        <span className="coverage__unit">%</span>
      </div>
      <div className="coverage__detail">
        <span className="coverage__caption">
          {coverage.traced} of {coverage.total} requirements fully traced
        </span>
        <div className="cells" role="img" aria-label={`${coverage.traced} of ${coverage.total} requirements traced`}>
          {cells.map((c, i) => (
            <span
              key={'requirementId' in c ? String(c.requirementId) : i}
              className={`cell cell--${c.status}`}
              title={'requirementId' in c ? `${c.requirementId}: ${c.status}` : undefined}
              style={{ animationDelay: `${i * 40}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SeverityCounts({ gaps }: { gaps: Gap[] }) {
  return (
    <dl className="counts">
      {SEVERITIES.map((s) => (
        <div key={s} className={`count count--${s}`}>
          <dt>{s}</dt>
          <dd>{gaps.filter((g) => g.severity === s).length}</dd>
        </div>
      ))}
    </dl>
  );
}

type NodeState = 'ok' | 'gap' | 'empty';

interface RailNode {
  label: string;
  value: ReactNode;
  state: NodeState;
  hint?: string;
}

function nodeState(items: unknown[], gaps: Gap[], codes: GapCode[], optional = false): NodeState {
  if (gaps.some((g) => codes.includes(g.code))) return 'gap';
  if (items.length === 0) return optional ? 'empty' : 'gap';
  return 'ok';
}

function list(items: string[], gaps: Gap[], codes: GapCode[]): ReactNode {
  const gap = gaps.find((g) => codes.includes(g.code));
  if (items.length === 0) return gap ? gap.code : '—';
  return items.join(', ');
}

/** Requirement → hazard → work → change → test, with broken links drawn where a gap sits. */
export function TraceRail({ row }: { row: MatrixRow }) {
  const { gaps } = row;
  const failing = row.tests.filter((t) => t.result !== 'passed').map((t) => t.key);
  const testGap = gaps.find((g) => g.code === 'G2' || g.code === 'G3' || g.code === 'G5');
  const nodes: RailNode[] = [
    {
      label: 'Hazard',
      value: row.hazards.length ? row.hazards.map((h) => h.id).join(', ') : '—',
      state: row.hazards.length ? 'ok' : 'empty',
      hint: row.hazards.map((h) => `${h.id}: ${h.title}`).join('\n') || 'No hazard linked',
    },
    {
      label: 'Work',
      value: list(row.workItems, gaps, ['G1']),
      state: nodeState(row.workItems, gaps, ['G1']),
      hint: gaps.find((g) => g.code === 'G1')?.message,
    },
    {
      label: 'Change',
      value: row.pullRequests.length ? row.pullRequests.join(', ') : '—',
      state: row.pullRequests.length ? 'ok' : 'empty',
    },
    {
      label: 'Test',
      value: testGap && row.tests.length === 0 ? testGap.code : row.tests.map((t) => t.key).join(', ') || '—',
      state: nodeState(row.tests, gaps, ['G2', 'G3', 'G5']),
      hint: testGap?.message ?? (failing.length ? `Not passing: ${failing.join(', ')}` : undefined),
    },
  ];
  return (
    <ol className="rail">
      {nodes.map((n) => (
        <li key={n.label} className={`rail__node rail__node--${n.state}`} title={n.hint}>
          <span className="rail__dot" aria-hidden="true" />
          <span className="rail__label">{n.label}</span>
          <span className="rail__value">{n.value}</span>
          <span className="visually-hidden">{n.state === 'gap' ? ' (gap)' : ''}</span>
        </li>
      ))}
    </ol>
  );
}

export function GapItem({ gap }: { gap: Gap }) {
  return (
    <li className={`gap gap--${gap.severity}`}>
      <span className="gap__code">{gap.code}</span>
      <div className="gap__body">
        <p className="gap__head">
          <strong>{GAP_LABEL[gap.code]}</strong>
          <SeverityTag value={gap.severity} />
        </p>
        <p className="gap__msg">{gap.message}</p>
        {gap.owner && <p className="gap__owner">Owner: {gap.owner}</p>}
      </div>
    </li>
  );
}

export function GapList({ gaps, empty = 'No open gaps. This release is audit-ready.' }: { gaps: Gap[]; empty?: string }) {
  if (gaps.length === 0) return <p className="empty">{empty}</p>;
  return (
    <ul className="gaps">
      {gaps.map((g) => (
        <GapItem key={g.id} gap={g} />
      ))}
    </ul>
  );
}

/** Same analysis the `check_change_impact` MCP tool gives coding agents, for humans. */
export function ImpactChecker({ example = 'src/dosing/limits.ts' }: { example?: string }) {
  const [files, setFiles] = useState(example);
  const [state, setState] = useState<{ loading: boolean; data?: ImpactView; error?: string }>({ loading: false });

  const run = async () => {
    setState({ loading: true });
    try {
      setState({ loading: false, data: await call<ImpactView>('checkImpact', { files }) });
    } catch (e) {
      setState({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <section className="panel" aria-labelledby="impact-title">
      <h2 id="impact-title" className="panel__title">
        Change impact
      </h2>
      <p className="panel__lede">What breaks traceability if these files change? Coding agents get the same answer over MCP.</p>
      <form
        className="impact__form"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <label className="visually-hidden" htmlFor="impact-files">
          File paths, comma separated
        </label>
        <input
          id="impact-files"
          className="input"
          value={files}
          onChange={(e) => setFiles(e.target.value)}
          placeholder="src/dosing/limits.ts, src/alarms/audio/volume.ts"
          maxLength={2000}
        />
        <button type="submit" className="btn btn--primary" disabled={state.loading || !files.trim()}>
          {state.loading ? 'Checking…' : 'Check'}
        </button>
      </form>
      {state.error && <p className="state state--error">{state.error}</p>}
      {state.data && <ImpactResult impact={state.data} />}
    </section>
  );
}

function ImpactResult({ impact }: { impact: ImpactView }) {
  return (
    <div className="impact">
      <p className={impact.requiresTracedIssue ? 'verdict verdict--stop' : 'verdict verdict--go'}>
        {impact.requiresTracedIssue ? 'Traced Jira issue required before merge' : 'No traced issue required'}
        {impact.highestSafetyClass && (
          <span>
            highest class <ClassBadge value={impact.highestSafetyClass} />
          </span>
        )}
      </p>
      {impact.requirements.length > 0 && (
        <ul className="impact__reqs">
          {impact.requirements.map((r) => (
            <li key={r.id}>
              <Key>{r.id}</Key> <ClassBadge value={r.safetyClass} /> {r.title}
              {r.hazards.length > 0 && (
                <span className="muted"> · mitigates {r.hazards.map((h) => `${h.id} ${h.title}`).join(', ')}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="impact__tests">
        <span className="muted">Re-run:</span>{' '}
        {impact.testsToRerun.length ? impact.testsToRerun.map((t) => <Key key={t.key}>{t.key}</Key>) : 'none'}
      </p>
    </div>
  );
}
