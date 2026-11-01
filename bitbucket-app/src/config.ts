import { parse } from 'yaml';

/**
 * `.traceguard.yml` at the root of the destination branch. Every field is optional:
 *
 *   # Name of this repository in TraceGuard (defaults to the Bitbucket slug).
 *   repo: cardiosense-firmware
 *   # Globs of safety-critical code (defaults to the paths set in TraceGuard for Jira).
 *   safety-critical:
 *     - src/dosing/**
 *     - src/alarms/**
 */
export const CONFIG_FILE = '.traceguard.yml';

export interface RepoConfig {
  repo?: string;
  safetyCriticalPaths?: string[];
}

export class ConfigError extends Error {}

const MAX_GLOBS = 50;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;

export function parseRepoConfig(text: string | undefined): RepoConfig {
  if (text === undefined || text.trim() === '') return {};
  let raw: unknown;
  try {
    raw = parse(text, { maxAliasCount: 0 });
  } catch (e) {
    throw new ConfigError(`${CONFIG_FILE} is not valid YAML: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
  }
  if (raw === null || raw === undefined) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new ConfigError(`${CONFIG_FILE} must be a YAML mapping.`);
  const doc = raw as Record<string, unknown>;
  const config: RepoConfig = {};

  if (doc.repo !== undefined) {
    if (typeof doc.repo !== 'string' || !REPO.test(doc.repo)) throw new ConfigError(`"repo" in ${CONFIG_FILE} must be a repository slug.`);
    config.repo = doc.repo;
  }
  const globs = doc['safety-critical'] ?? doc.safetyCritical;
  if (globs !== undefined) {
    if (!Array.isArray(globs) || globs.length > MAX_GLOBS || globs.some((g) => typeof g !== 'string' || !g.trim() || g.length > 300)) {
      throw new ConfigError(`"safety-critical" in ${CONFIG_FILE} must be a list of up to ${MAX_GLOBS} path globs.`);
    }
    config.safetyCriticalPaths = globs.map((g: string) => g.trim());
  }
  return config;
}
