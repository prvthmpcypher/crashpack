import { describe, it, expect } from 'vitest';
import { collectLogs, stripBinaryAndControlChars, sanitizeLogContent } from './logs.js';
import { redact } from '../redact/redact.js';

describe('Logs Collector & Sanitization', () => {
  it('strips binary garbage and ANSI escape codes', () => {
    const rawWithAnsiAndBinary = '\x1B[31mError:\x1B[0m something broke\x00\x07\x1F here';
    const cleaned = stripBinaryAndControlChars(rawWithAnsiAndBinary);
    expect(cleaned).toBe('Error: something broke here');
  });

  it('truncates lines exceeding 2000 characters', () => {
    const longLine = 'A'.repeat(3000);
    const sanitized = sanitizeLogContent(longLine, 200);
    expect(sanitized.length).toBeLessThan(2100);
    expect(sanitized).toContain('... [line truncated at 2000 chars]');
  });

  it('keeps only the last N lines', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `Line ${i + 1}`).join('\n');
    const sanitized = sanitizeLogContent(lines, 10);
    const split = sanitized.split('\n');
    expect(split.length).toBe(10);
    expect(split[0]).toBe('Line 41');
    expect(split[9]).toBe('Line 50');
  });

  it('collects stdin logs and passes through redact', async () => {
    const logData = 'Failed to connect to database at postgres://user:secret123@localhost:5432/app\n[ERROR] Crash occurred';
    const res = await collectLogs({ cwd: process.cwd(), stdinLog: logData, lines: 200 });
    expect(res.id).toBe('logs');
    expect(res.status).toBe('ok');
    expect(res.rawContent).toBeDefined();

    const { text, count } = redact(res.rawContent!);
    expect(text).not.toContain('secret123');
    expect(text).toContain('postgres://user:[redacted]@localhost:5432/app');
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('marks logs as unavailable when no wrap or stdin is given', async () => {
    const res = await collectLogs({ cwd: process.cwd() });
    expect(res.status).toBe('unavailable');
    expect(res.unavailableReason).toBeDefined();
  });
});
