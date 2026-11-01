import type { TraceConfig, TraceSnapshot } from '../core/types';
import { DEMO_REPO, demoConfig, demoSnapshot } from '../demo/cardiosense';

export interface TraceSource {
  snapshot: TraceSnapshot;
  config: TraceConfig;
  defaultRepo: string;
  /** True while data comes from the built-in CardioSense fixture instead of Jira/Confluence/Forge SQL. */
  simulated: boolean;
}

/**
 * Spike stage: every surface reads the static CardioSense fixture.
 * Replace with a Forge SQL-backed source once the indexer exists.
 */
export async function loadTraceSource(): Promise<TraceSource> {
  return { snapshot: demoSnapshot, config: demoConfig, defaultRepo: DEMO_REPO, simulated: true };
}
