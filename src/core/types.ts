export type SafetyClass = 'A' | 'B' | 'C';
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type GapCode = 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6';

export interface Requirement {
  id: string;
  title: string;
  safetyClass: SafetyClass;
  status: 'draft' | 'approved';
  approvedAt?: string;
  lastEditedAt?: string;
  changeRequestKey?: string;
  hazardIds: string[];
  /** Globs of code that implements this requirement (from SRS table or .traceguard.yml). */
  paths: string[];
  url?: string;
}

export interface Hazard {
  id: string;
  title: string;
  severity: 'catastrophic' | 'critical' | 'serious' | 'minor';
}

export interface WorkItem {
  key: string;
  title: string;
  requirementIds: string[];
  fixVersions: string[];
  assignee?: string;
}

export interface TestRun {
  result: 'passed' | 'failed';
  at: string;
  build?: string;
}

export interface TestCase {
  key: string;
  title: string;
  requirementIds: string[];
  fixVersions: string[];
  lastRun?: TestRun;
  owner?: string;
}

export interface PullRequest {
  id: string;
  repo: string;
  title: string;
  issueKeys: string[];
  files: string[];
  mergedAt?: string;
  author?: string;
  simulated?: boolean;
}

export interface Release {
  name: string;
  releaseDate?: string;
  signedOff: boolean;
}

export interface TraceSnapshot {
  requirements: Requirement[];
  hazards: Hazard[];
  workItems: WorkItem[];
  testCases: TestCase[];
  pullRequests: PullRequest[];
  releases: Release[];
}

export interface TraceConfig {
  /** Globs of safety-critical code. A PR touching these must trace to a requirement (G4). */
  safetyCriticalPaths: string[];
}

export interface Gap {
  id: string;
  code: GapCode;
  severity: Severity;
  message: string;
  requirementId?: string;
  artifactKey?: string;
  owner?: string;
}
