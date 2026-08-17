import { describe, it, expect } from 'vitest';
import { collectGit } from './git.js';
import * as path from 'node:path';
import * as os from 'node:os';

describe('Git Collector', () => {
  it('collects git context in a valid git repository', async () => {
    // Run in current repo or workspace
    const result = await collectGit({ cwd: process.cwd(), timeoutMs: 2000 });
    expect(result.id).toBe('git');
    expect(result.title).toBe('Git');
    // Result should either be ok (if in git) or unavailable (if not in git)
    if (result.status === 'ok') {
      expect(result.rawContent).toBeDefined();
      expect(result.rawContent).toContain('Branch:');
    } else {
      expect(result.unavailableReason).toBeDefined();
    }
  });

  it('degrades to unavailable when directory is not a git repo', async () => {
    const tempDir = os.tmpdir();
    const result = await collectGit({ cwd: tempDir, timeoutMs: 2000 });
    expect(result.id).toBe('git');
    expect(result.status).toBe('unavailable');
    expect(result.unavailableReason?.toLowerCase()).toContain('not a git repository');
  });
});
