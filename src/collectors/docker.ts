import { execa } from 'execa';
import { asRawText, Collector, CollectorResult } from '../types.js';

export const collectDocker: Collector = async (ctx) => {
  const timeout = ctx.timeoutMs ?? 2000;

  try {
    // Check if docker CLI is installed and daemon is responsive
    const infoRes = await execa('docker', ['info', '--format', '{{.ServerVersion}}'], {
      timeout,
      reject: false,
    });

    if (infoRes.exitCode !== 0) {
      const errOutput = (infoRes.stderr || infoRes.stdout || '').toLowerCase();
      if (errOutput.includes('daemon') || errOutput.includes('connect') || errOutput.includes('pipe')) {
        return {
          id: 'docker',
          title: 'Docker',
          status: 'unavailable',
          unavailableReason: 'daemon not running',
        };
      }
      return {
        id: 'docker',
        title: 'Docker',
        status: 'unavailable',
        unavailableReason: 'docker not installed',
      };
    }

    // List recent containers
    const psRes = await execa(
      'docker',
      ['ps', '-a', '--format', '{{.Names}}\t{{.Status}}\t{{.State}}'],
      {
        timeout,
        reject: false,
      }
    );

    const lines: string[] = ['- Daemon: running'];

    if (psRes.exitCode === 0 && psRes.stdout.trim()) {
      const rawLines = psRes.stdout.trim().split('\n').filter(Boolean);
      for (const line of rawLines) {
        const parts = line.split('\t');
        const name = parts[0] || 'unknown';
        const status = parts[1] || 'unknown';
        const state = parts[2] || '';

        // Check if exited or failed
        let marker = '';
        if (
          state === 'exited' ||
          state === 'dead' ||
          status.toLowerCase().includes('exited (') ||
          status.toLowerCase().includes('unhealthy')
        ) {
          // If non-zero exit code or unhealthy
          if (!status.includes('Exited (0)')) {
            marker = '  ← likely relevant';
          }
        }

        lines.push(`- \`${name}\` — ${status}${marker}`);
      }
    } else {
      lines.push('- No active containers');
    }

    return {
      id: 'docker',
      title: 'Docker',
      status: 'ok',
      rawContent: asRawText(lines.join('\n')),
    };
  } catch (err: any) {
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('enoent') || msg.includes('not found')) {
      return {
        id: 'docker',
        title: 'Docker',
        status: 'unavailable',
        unavailableReason: 'docker not installed',
      };
    }
    return {
      id: 'docker',
      title: 'Docker',
      status: 'unavailable',
      unavailableReason: 'daemon not running',
    };
  }
};
