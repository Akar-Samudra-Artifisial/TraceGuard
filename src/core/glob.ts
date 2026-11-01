const cache = new Map<string, RegExp>();

/**
 * Minimal glob matcher for repository paths: `**` crosses directories,
 * `*` and `?` stay within one path segment.
 */
export function globToRegExp(glob: string): RegExp {
  const cached = cache.get(glob);
  if (cached) return cached;

  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob.charAt(i);
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        const slashAfter = glob[i + 2] === '/';
        re += slashAfter ? '(?:.*/)?' : '.*';
        i += slashAfter ? 2 : 1;
      } else {
        re += '[^/]*';
      }
    } else if (ch === '?') {
      re += '[^/]';
    } else {
      re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  const compiled = new RegExp(`^${re}$`);
  cache.set(glob, compiled);
  return compiled;
}

export function normalizePath(path: string): string {
  return path.trim().replace(/\\/g, '/').replace(/^\.?\//, '');
}

export function matchesGlob(path: string, glob: string): boolean {
  return globToRegExp(normalizePath(glob)).test(normalizePath(path));
}

export function matchesAny(path: string, globs: readonly string[]): boolean {
  return globs.some((g) => matchesGlob(path, g));
}

/** True when `file` is `target` itself or lives under the folder `target`. */
export function isWithin(file: string, target: string): boolean {
  const f = normalizePath(file);
  const t = normalizePath(target).replace(/\/$/, '');
  return f === t || f.startsWith(`${t}/`);
}
