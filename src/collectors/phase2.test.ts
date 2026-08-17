import { describe, it, expect } from 'vitest';
import { collectSystem } from './system.js';
import { collectRuntimes } from './runtimes.js';
import { collectGit } from './git.js';
import { redact } from '../redact/redact.js';

describe('Phase 2 Collectors (Git, System, Runtimes)', () => {
  it('collectSystem produces valid markdown table with OS, CPU, Memory', async () => {
    const res = await collectSystem({ cwd: process.cwd(), timeoutMs: 2000 });
    expect(res.id).toBe('system');
    expect(res.status).toBe('ok');
    expect(res.rawContent).toBeDefined();

    // Verify through redaction pipeline
    const { text } = redact(res.rawContent!);
    expect(text).toContain('| OS |');
    expect(text).toContain('| CPU |');
    expect(text).toContain('| Memory |');
  });

  it('collectRuntimes discovers Node and formats versions', async () => {
    const res = await collectRuntimes({ cwd: process.cwd(), timeoutMs: 2000 });
    expect(res.id).toBe('runtimes');
    expect(res.status).toBe('ok');
    expect(res.rawContent).toBeDefined();

    const { text } = redact(res.rawContent!);
    expect(text).toContain('- Node `');
  });

  it('collectGit produces git context that safely passes through redact()', async () => {
    const res = await collectGit({ cwd: process.cwd(), timeoutMs: 2000 });
    expect(res.id).toBe('git');
    if (res.status === 'ok') {
      const { text } = redact(res.rawContent!);
      expect(text).toContain('Branch:');
    }
  });
});
