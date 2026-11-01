import type { TraceConfig, TraceSnapshot } from '../core/types';

/**
 * Fictional CardioSense dataset (class C ECG monitor with dose advisory).
 * Release 2.3 contains exactly one intentional example of each gap G1–G6.
 */
export const DEMO_REPO = 'cardiosense-firmware';

export const demoConfig: TraceConfig = {
  safetyCriticalPaths: ['src/dosing/**', 'src/alarms/**', 'src/ecg/**'],
};

export const demoSnapshot: TraceSnapshot = {
  releases: [
    { name: '2.2', releaseDate: '2026-08-15', signedOff: true },
    { name: '2.3', releaseDate: '2026-12-01', signedOff: false },
  ],
  hazards: [
    { id: 'HAZ-01', title: 'Missed arrhythmia alarm', severity: 'catastrophic' },
    { id: 'HAZ-03', title: 'Incorrect heart rate shown', severity: 'serious' },
    { id: 'HAZ-07', title: 'Dose advisory above safe maximum', severity: 'catastrophic' },
  ],
  requirements: [
    {
      id: 'REQ-101', title: 'Heart rate accuracy within ±2 bpm', safetyClass: 'C', status: 'approved',
      approvedAt: '2026-07-01T09:00:00Z', lastEditedAt: '2026-07-01T09:00:00Z',
      hazardIds: ['HAZ-03'], paths: ['src/ecg/qrs/**'],
    },
    {
      id: 'REQ-104', title: 'Arrhythmia alarm raised within 10 s', safetyClass: 'C', status: 'approved',
      approvedAt: '2026-07-01T09:00:00Z', lastEditedAt: '2026-07-01T09:00:00Z',
      hazardIds: ['HAZ-01'], paths: ['src/alarms/arrhythmia/**'],
    },
    {
      id: 'REQ-107', title: 'Lead-off detection', safetyClass: 'B', status: 'approved',
      approvedAt: '2026-07-01T09:00:00Z', lastEditedAt: '2026-07-01T09:00:00Z',
      hazardIds: ['HAZ-03'], paths: ['src/ecg/leads/**'],
    },
    {
      id: 'REQ-109', title: 'Low battery warning at 15%', safetyClass: 'B', status: 'approved',
      approvedAt: '2026-07-01T09:00:00Z', lastEditedAt: '2026-07-01T09:00:00Z',
      hazardIds: [], paths: ['src/power/**'],
    },
    {
      id: 'REQ-110', title: 'Export ECG strip to PDF', safetyClass: 'A', status: 'approved',
      approvedAt: '2026-07-01T09:00:00Z', lastEditedAt: '2026-07-01T09:00:00Z',
      hazardIds: [], paths: ['src/export/**'],
    },
    {
      id: 'REQ-112', title: 'Enforce maximum dose limit', safetyClass: 'C', status: 'approved',
      approvedAt: '2026-07-01T09:00:00Z', lastEditedAt: '2026-07-01T09:00:00Z',
      hazardIds: ['HAZ-07'], paths: ['src/dosing/limits.ts'],
    },
    {
      id: 'REQ-115', title: 'Alarm volume never below 45 dB', safetyClass: 'B', status: 'approved',
      approvedAt: '2026-07-01T09:00:00Z', lastEditedAt: '2026-07-01T09:00:00Z',
      hazardIds: ['HAZ-01'], paths: ['src/alarms/audio/**'],
    },
    {
      id: 'REQ-118', title: 'Encrypt patient data at rest', safetyClass: 'B', status: 'approved',
      approvedAt: '2026-09-01T09:00:00Z', lastEditedAt: '2026-10-25T14:30:00Z',
      hazardIds: [], paths: ['src/storage/**'],
    },
  ],
  workItems: [
    { key: 'CSM-11', title: 'QRS detector tuning', requirementIds: ['REQ-101'], fixVersions: ['2.3'], assignee: 'Rina' },
    { key: 'CSM-14', title: 'Arrhythmia alarm pipeline', requirementIds: ['REQ-104'], fixVersions: ['2.3'], assignee: 'Dimas' },
    { key: 'CSM-17', title: 'Lead-off detection', requirementIds: ['REQ-107'], fixVersions: ['2.3'], assignee: 'Rina' },
    { key: 'CSM-19', title: 'Battery warning banner', requirementIds: ['REQ-109'], fixVersions: ['2.3'], assignee: 'Sari' },
    // G1: REQ-110 has no story in 2.3.
    { key: 'CSM-41', title: 'Dose limit table update', requirementIds: ['REQ-112'], fixVersions: ['2.3'], assignee: 'Bayu' },
    { key: 'CSM-45', title: 'Alarm audio driver', requirementIds: ['REQ-115'], fixVersions: ['2.3'], assignee: 'Dimas' },
    { key: 'CSM-48', title: 'Storage encryption', requirementIds: ['REQ-118'], fixVersions: ['2.3'], assignee: 'Sari' },
  ],
  testCases: [
    { key: 'CSM-T1', title: 'HR accuracy on MIT-BIH set', requirementIds: ['REQ-101'], fixVersions: ['2.3'],
      lastRun: { result: 'passed', at: '2026-10-12T10:00:00Z', build: '2.3.0-rc1' }, owner: 'Rina' },
    { key: 'CSM-T4', title: 'Alarm latency under load', requirementIds: ['REQ-104'], fixVersions: ['2.3'],
      lastRun: { result: 'passed', at: '2026-10-12T10:00:00Z', build: '2.3.0-rc1' }, owner: 'Dimas' },
    { key: 'CSM-T7', title: 'Lead-off detection bench test', requirementIds: ['REQ-107'], fixVersions: ['2.3'],
      lastRun: { result: 'passed', at: '2026-10-12T10:00:00Z', build: '2.3.0-rc1' }, owner: 'Rina' },
    // G2: REQ-109 has no test case.
    { key: 'CSM-T10', title: 'PDF export renders strip', requirementIds: ['REQ-110'], fixVersions: ['2.3'],
      lastRun: { result: 'passed', at: '2026-10-12T10:00:00Z', build: '2.3.0-rc1' }, owner: 'Sari' },
    // G5: both dose tests passed before PR-57 was merged.
    { key: 'CSM-T12', title: 'Dose above max is rejected', requirementIds: ['REQ-112'], fixVersions: ['2.3'],
      lastRun: { result: 'passed', at: '2026-10-15T10:00:00Z', build: '2.3.0-rc1' }, owner: 'Bayu' },
    { key: 'CSM-T13', title: 'Dose limit boundary values', requirementIds: ['REQ-112'], fixVersions: ['2.3'],
      lastRun: { result: 'passed', at: '2026-10-15T10:00:00Z', build: '2.3.0-rc1' }, owner: 'Bayu' },
    // G3: alarm volume test failed.
    { key: 'CSM-T15', title: 'Minimum alarm volume', requirementIds: ['REQ-115'], fixVersions: ['2.3'],
      lastRun: { result: 'failed', at: '2026-10-28T10:00:00Z', build: '2.3.0-rc2' }, owner: 'Dimas' },
    // G6 is on REQ-118 itself (edited after approval); its test passes.
    { key: 'CSM-T18', title: 'Data at rest is encrypted', requirementIds: ['REQ-118'], fixVersions: ['2.3'],
      lastRun: { result: 'passed', at: '2026-10-12T10:00:00Z', build: '2.3.0-rc1' }, owner: 'Sari' },
  ],
  pullRequests: [
    { id: 'PR-41', repo: DEMO_REPO, title: 'CSM-11 tune QRS thresholds', issueKeys: ['CSM-11'],
      files: ['src/ecg/qrs/detector.ts'], mergedAt: '2026-10-10T08:00:00Z', author: 'Rina', simulated: true },
    { id: 'PR-44', repo: DEMO_REPO, title: 'CSM-14 alarm pipeline', issueKeys: ['CSM-14'],
      files: ['src/alarms/arrhythmia/pipeline.ts'], mergedAt: '2026-10-09T08:00:00Z', author: 'Dimas', simulated: true },
    { id: 'PR-57', repo: DEMO_REPO, title: 'CSM-41 update dose limit table', issueKeys: ['CSM-41'],
      files: ['src/dosing/limits.ts', 'src/dosing/limits.test.ts'], mergedAt: '2026-10-20T08:00:00Z', author: 'Bayu', simulated: true },
    // G4: untraced change to safety-critical dosing code, still open.
    { id: 'PR-63', repo: DEMO_REPO, title: 'Tweak dose rounding', issueKeys: [],
      files: ['src/dosing/rounding.ts'], author: 'Andi', simulated: true },
    // Untraced but not safety-critical: no gap.
    { id: 'PR-64', repo: DEMO_REPO, title: 'Dark theme colours', issueKeys: [],
      files: ['src/ui/theme.ts'], author: 'Andi', simulated: true },
  ],
};
