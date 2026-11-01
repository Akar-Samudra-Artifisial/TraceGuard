// Background handlers only log for now; TraceGuard reads Jira live on every request.

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
