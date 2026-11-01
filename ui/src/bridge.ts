import { invoke, view } from '@forge/bridge';
import { useCallback, useEffect, useState } from 'react';

/** Calls a resolver function and turns `{ error }` replies into thrown errors. */
export async function call<T>(name: string, payload?: Record<string, unknown>): Promise<T> {
  const reply = (await invoke(name, payload)) as T | { error: string } | undefined;
  if (!reply) throw new Error('TraceGuard returned an empty response.');
  if (typeof reply === 'object' && 'error' in (reply as object)) throw new Error((reply as { error: string }).error);
  return reply as T;
}

export interface Remote<T> {
  data?: T;
  error?: string;
  loading: boolean;
  reload: () => void;
}

/** Loads resolver data and re-runs whenever `deps` change. */
export function useRemote<T>(name: string, payload: Record<string, unknown> | undefined, deps: unknown[]): Remote<T> {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    call<T>(name, payload)
      .then((data) => alive && setState({ data, loading: false }))
      .catch((e: unknown) => alive && setState({ error: e instanceof Error ? e.message : String(e), loading: false }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, tick, ...deps]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

export function enableTheme(): void {
  view.theme.enable().catch(() => undefined);
}

export interface ForgeContext {
  localId?: string;
  extension?: { issue?: { key?: string }; type?: string };
}

export async function getContext(): Promise<ForgeContext> {
  try {
    return (await view.getContext()) as unknown as ForgeContext;
  } catch {
    return {};
  }
}

/** `ari:cloud:ecosystem::extension/<appId>/<envId>/static/<key>` → `<appId>`. */
export function appIdFrom(localId?: string): string | undefined {
  return localId?.match(/extension\/([0-9a-f-]{36})\//)?.[1];
}
