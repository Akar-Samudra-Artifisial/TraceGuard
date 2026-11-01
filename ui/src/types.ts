import type { Coverage, Gap, GapCode, Hazard, Release, SafetyClass, Severity } from '../../src/core';
import type { ChangeImpact, TraceResult } from '../../src/core';

export type { ChangeImpact, Coverage, Gap, GapCode, Hazard, Release, SafetyClass, Severity, TraceResult };

export type TestResult = 'passed' | 'failed' | 'not-run';

export interface MatrixRow {
  requirementId: string;
  title: string;
  safetyClass: SafetyClass;
  hazards: Hazard[];
  workItems: string[];
  pullRequests: string[];
  tests: { key: string; result: TestResult }[];
  status: 'traced' | 'gap';
  gaps: Gap[];
}

export interface Overview {
  summary: string;
  release: string;
  releases: Release[];
  coverage: Coverage;
  rows: MatrixRow[];
  gaps: Gap[];
  untracedChanges: Gap[];
  projectKey: string | null;
  simulatedPullRequests: boolean;
  simulated: boolean;
}

export interface SetupInfo {
  summary: string;
  dataSource: 'demo' | 'live';
  projectKey: string | null;
  fallbackReason: string | null;
  defaultRepo: string;
  safetyCriticalPaths: string[];
  releases: Release[];
  counts: Record<'requirements' | 'hazards' | 'workItems' | 'testCases' | 'pullRequests', number>;
  requirementPaths: { id: string; safetyClass: SafetyClass; paths: string[] }[];
  simulated: boolean;
}

export interface PublishResult {
  summary: string;
  pageTitle: string;
  pageUrl: string;
  space: string;
}

export interface SeedResult {
  summary: string;
  projectKey: string;
  created: Record<'requirements' | 'hazards' | 'workItems' | 'testCases' | 'links', number>;
}

export interface TestCandidates {
  summary: string;
  requirement: { id: string; key: string };
  release: string;
  candidates: { key: string; title: string; verifies: string[]; inRelease: boolean; lastRun?: { result: 'passed' | 'failed'; at: string } }[];
}

export interface LinkResult {
  summary: string;
  requirementId: string;
  testKey: string;
  created: boolean;
}

export type TraceView = TraceResult & { summary: string; simulated: boolean };
export type ImpactView = ChangeImpact & { summary: string; repo: string; simulated: boolean };
