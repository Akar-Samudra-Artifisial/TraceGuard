import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Box,
  Button,
  Heading,
  Inline,
  Label,
  SectionMessage,
  Stack,
  Text,
  Textfield,
} from '@forge/react';
import { invoke } from '@forge/bridge';

type Status = { connected: boolean; host?: string; connectedAt?: string };
type Reply = { ok?: boolean; error?: string; status?: Status };

function App() {
  const [status, setStatus] = useState<Status>();
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string }>();

  useEffect(() => {
    void invoke<Status>('getStatus').then((r) => setStatus(r as Status));
  }, []);

  const save = async () => {
    setBusy(true);
    setNotice(undefined);
    const r = (await invoke<Reply>('saveConnection', { url, secret })) as Reply;
    setBusy(false);
    if (r.error) return setNotice({ ok: false, text: r.error });
    setStatus(r.status);
    setSecret('');
    setNotice({ ok: true, text: 'Connected. Jira answered the signed test request.' });
  };

  const test = async () => {
    setBusy(true);
    const r = (await invoke<Reply>('testConnection')) as Reply;
    setBusy(false);
    setNotice(r.ok ? { ok: true, text: 'Jira answered the signed test request.' } : { ok: false, text: r.error ?? 'Test failed.' });
  };

  return (
    <Stack space="space.200">
      <Heading as="h2">TraceGuard trace check</Heading>
      <Text>
        Blocks pull requests that change safety-critical code without a Jira issue traced to the affected requirement.
        After connecting, enable “TraceGuard trace check” under Repository settings → Merge checks and mark it Required.
      </Text>
      {status && (
        <SectionMessage appearance={status.connected ? 'success' : 'warning'}>
          <Text>
            {status.connected
              ? `Connected to ${status.host}${status.connectedAt ? ` since ${status.connectedAt.slice(0, 10)}` : ''}.`
              : 'Not connected. In Jira, open Settings → Marketplace apps → TraceGuard setup → Connect Bitbucket → Create connection.'}
          </Text>
        </SectionMessage>
      )}
      <Box>
        <Label labelFor="tg-url">Web trigger URL</Label>
        <Textfield id="tg-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://….webtrigger.atlassian.app/public/…" />
      </Box>
      <Box>
        <Label labelFor="tg-secret">Secret</Label>
        <Textfield id="tg-secret" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="tgs_…" />
      </Box>
      <Inline space="space.100">
        <Button appearance="primary" onClick={() => void save()} isDisabled={busy || !url || !secret}>
          {status?.connected ? 'Replace connection' : 'Connect'}
        </Button>
        {status?.connected && (
          <Button onClick={() => void test()} isDisabled={busy}>
            Test connection
          </Button>
        )}
      </Inline>
      {notice && (
        <SectionMessage appearance={notice.ok ? 'success' : 'error'}>
          <Text>{notice.text}</Text>
        </SectionMessage>
      )}
    </Stack>
  );
}

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
