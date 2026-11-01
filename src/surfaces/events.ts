// Spike stage: background handlers only log. The indexer (Jira/Confluence -> Forge SQL) comes next.

interface ProductEvent {
  eventType?: string;
}

export async function onEvent(event: ProductEvent): Promise<void> {
  console.log('TraceGuard event received', { eventType: event?.eventType });
}

export async function reindex(event: unknown): Promise<void> {
  console.log('TraceGuard reindex requested', { hasBody: Boolean(event) });
}

export async function nightlySweep(): Promise<void> {
  console.log('TraceGuard nightly sweep (no-op in spike stage)');
}
