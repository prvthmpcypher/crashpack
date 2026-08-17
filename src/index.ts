import * as path from 'node:path';
import {
  Collector,
  CollectorContext,
  CrashPack,
  Section,
  SectionStatus,
} from './types.js';
import { redact } from './redact/redact.js';
import { collectLogs } from './collectors/logs.js';
import { collectGit } from './collectors/git.js';
import { collectSystem } from './collectors/system.js';
import { collectRuntimes } from './collectors/runtimes.js';
import { collectPackages } from './collectors/packages.js';
import { collectDocker } from './collectors/docker.js';
import { collectPorts } from './collectors/ports.js';
import { collectEnv } from './collectors/env.js';
import { renderMarkdown } from './render/markdown.js';

export * from './types.js';
export * from './redact/redact.js';
export * from './render/markdown.js';

export interface RunCollectorOptions {
  cwd?: string;
  timeoutMs?: number;
  lines?: number;
  stdinLog?: string;
  wrapBuffer?: string;
  only?: string[];
  skip?: string[];
  redactExtra?: RegExp[];
  onCollectorStart?: (id: string) => void;
  onCollectorComplete?: (id: string, status: SectionStatus, reason?: string) => void;
}

const ALL_COLLECTORS: { id: string; title: string; fn: Collector }[] = [
  { id: 'logs', title: 'Logs', fn: collectLogs },
  { id: 'git', title: 'Git', fn: collectGit },
  { id: 'system', title: 'System', fn: collectSystem },
  { id: 'runtimes', title: 'Runtimes', fn: collectRuntimes },
  { id: 'packages', title: 'Packages', fn: collectPackages },
  { id: 'docker', title: 'Docker', fn: collectDocker },
  { id: 'ports', title: 'Ports', fn: collectPorts },
  { id: 'env', title: 'Environment', fn: collectEnv },
];

export async function createCrashPack(options: RunCollectorOptions = {}): Promise<CrashPack> {
  const startTime = Date.now();
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const projectName = path.basename(cwd) || 'project';

  // Filter collectors
  let selected = ALL_COLLECTORS;
  if (options.only && options.only.length > 0) {
    const onlySet = new Set(options.only.map((s) => s.trim().toLowerCase()));
    selected = selected.filter((c) => onlySet.has(c.id.toLowerCase()));
  }
  if (options.skip && options.skip.length > 0) {
    const skipSet = new Set(options.skip.map((s) => s.trim().toLowerCase()));
    selected = selected.filter((c) => !skipSet.has(c.id.toLowerCase()));
  }

  const ctx: CollectorContext = {
    cwd,
    timeoutMs: options.timeoutMs ?? 2000,
    lines: options.lines ?? 200,
    stdinLog: options.stdinLog,
    wrapBuffer: options.wrapBuffer,
  };

  let totalRedactions = 0;

  const collectorPromises = selected.map(async ({ id, title, fn }) => {
    const colStart = Date.now();
    options.onCollectorStart?.(id);

    try {
      const res = await fn(ctx);
      const colDuration = Date.now() - colStart;

      let section: Section;
      if (res.status === 'ok' && res.rawContent !== undefined) {
        // MANDATORY: RawText MUST pass through redact() to become SafeText
        const { text: safeContent, count } = redact(res.rawContent, options.redactExtra);
        totalRedactions += count;

        section = {
          id,
          title,
          status: 'ok',
          content: safeContent,
          durationMs: colDuration,
        };
      } else {
        section = {
          id,
          title,
          status: 'unavailable',
          unavailableReason: res.unavailableReason || 'unavailable',
          durationMs: colDuration,
        };
      }

      options.onCollectorComplete?.(id, section.status, section.unavailableReason);
      return section;
    } catch (err: any) {
      const colDuration = Date.now() - colStart;
      const section: Section = {
        id,
        title,
        status: 'unavailable',
        unavailableReason: err?.message || 'collector error',
        durationMs: colDuration,
      };
      options.onCollectorComplete?.(id, 'unavailable', section.unavailableReason);
      return section;
    }
  });

  const sectionResults = await Promise.all(collectorPromises);

  // Preserve canonical display order
  const orderMap = new Map(ALL_COLLECTORS.map((c, i) => [c.id, i]));
  sectionResults.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

  const totalDuration = Date.now() - startTime;
  const now = new Date();
  const formattedDate = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')} ${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')} UTC`;

  return {
    projectName,
    sections: sectionResults,
    generatedAt: formattedDate,
    durationMs: totalDuration,
    redactionCount: totalRedactions,
  };
}
