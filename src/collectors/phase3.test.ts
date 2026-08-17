import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { collectPackages } from './packages.js';
import { collectDocker } from './docker.js';
import { collectPorts } from './ports.js';
import { collectEnv } from './env.js';
import { redact } from '../redact/redact.js';

describe('Phase 3 Collectors (Packages, Docker, Ports, Env)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crashpack-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Packages Collector', () => {
    it('parses package.json and limits output to 20 items with count', async () => {
      const deps: Record<string, string> = {};
      for (let i = 1; i <= 25; i++) {
        deps[`pkg-${i}`] = `^1.0.${i}`;
      }
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ dependencies: deps })
      );

      const res = await collectPackages({ cwd: tempDir });
      expect(res.id).toBe('packages');
      expect(res.status).toBe('ok');
      expect(res.rawContent).toContain('| pkg-1 |');
      expect(res.rawContent).toContain('_...and 5 more_');
    });

    it('parses requirements.txt and Cargo.toml', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'requirements.txt'),
        'flask==3.0.0\npytest>=8.0.0\n# comment\n'
      );
      fs.writeFileSync(
        path.join(tempDir, 'Cargo.toml'),
        '[dependencies]\nserde = "1.0"\ntokio = { version = "1.28" }\n'
      );

      const res = await collectPackages({ cwd: tempDir });
      expect(res.status).toBe('ok');
      expect(res.rawContent).toContain('flask');
      expect(res.rawContent).toContain('serde');
      expect(res.rawContent).toContain('tokio');
    });
  });

  describe('Docker Collector', () => {
    it('returns a status (ok or unavailable) without throwing', async () => {
      const res = await collectDocker({ cwd: tempDir, timeoutMs: 2000 });
      expect(res.id).toBe('docker');
      expect(['ok', 'unavailable']).toContain(res.status);
      if (res.status === 'unavailable') {
        expect(res.unavailableReason).toBeDefined();
      }
    });
  });

  describe('Ports Collector', () => {
    it('probes common ports and returns ok status', async () => {
      const res = await collectPorts({ cwd: tempDir });
      expect(res.id).toBe('ports');
      expect(res.status).toBe('ok');
      expect(res.rawContent).toBeDefined();
    });
  });

  describe('Environment Collector', () => {
    it('extracts ONLY key names and NEVER includes values in output', async () => {
      const secretVal1 = 'super_secret_db_pass_998877';
      const secretVal2 = 'sk_' + 'live_' + 'very_secret_key_12345';
      const normalVal = 'http://localhost:8080/api';

      fs.writeFileSync(
        path.join(tempDir, '.env'),
        `DATABASE_URL=postgres://user:${secretVal1}@localhost/db\nSTRIPE_KEY=${secretVal2}\nAPI_URL=${normalVal}\n`
      );

      const res = await collectEnv({ cwd: tempDir });
      expect(res.id).toBe('env');
      expect(res.status).toBe('ok');
      expect(res.rawContent).toBeDefined();

      const raw = res.rawContent!;
      // Assert keys are listed
      expect(raw).toContain('DATABASE_URL');
      expect(raw).toContain('STRIPE_KEY');
      expect(raw).toContain('API_URL');

      // CRITICAL ASSERTION: Zero values must appear in the env output
      expect(raw).not.toContain(secretVal1);
      expect(raw).not.toContain(secretVal2);
      expect(raw).not.toContain(normalVal);
      expect(raw).not.toContain('postgres://');

      // Passes through redact()
      const { text } = redact(raw);
      expect(text).toContain('Keys: API_URL, DATABASE_URL, STRIPE_KEY');
    });

    it('marks unavailable when no .env exists', async () => {
      const res = await collectEnv({ cwd: tempDir });
      expect(res.status).toBe('unavailable');
      expect(res.unavailableReason).toBe('no .env file found');
    });
  });
});
