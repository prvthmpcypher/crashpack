import { Command } from 'commander';
import pc from 'picocolors';
import clipboardy from 'clipboardy';
import { execa } from 'execa';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createCrashPack } from './index.js';
import { renderMarkdown } from './render/markdown.js';

interface CliArgs {
  wrap?: string;
  stdin?: boolean;
  out?: string;
  stdout?: boolean;
  json?: boolean;
  clipboard?: boolean;
  lines?: string;
  only?: string;
  skip?: string;
  redactExtra?: string[];
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      resolve(data);
    });
    process.stdin.on('error', () => {
      resolve(data);
    });
    // If stdin is a TTY and not piped, don't hang
    if (process.stdin.isTTY) {
      resolve('');
    }
  });
}

function parseRegexPattern(pattern: string): RegExp | null {
  try {
    if (pattern.startsWith('/') && pattern.lastIndexOf('/') > 0) {
      const lastSlash = pattern.lastIndexOf('/');
      const body = pattern.slice(1, lastSlash);
      const flags = pattern.slice(lastSlash + 1) || 'g';
      return new RegExp(body, flags.includes('g') ? flags : flags + 'g');
    }
    return new RegExp(pattern, 'g');
  } catch {
    return null;
  }
}

export async function runCli(argv = process.argv): Promise<number> {
  const program = new Command();

  program
    .name('crashpack')
    .description('Everything your bug report needs, in one command.')
    .version('0.1.0')
    .option('--wrap <command>', 'Run a command, stream live, and capture crash context on non-zero exit')
    .option('--stdin', 'Read piped input as the log section')
    .option('--out <path>', 'Write output to a specific file instead of temp')
    .option('--stdout', 'Print the markdown report to stdout')
    .option('--json', 'Emit the raw CrashPack JSON object')
    .option('--no-clipboard', 'Skip copying to clipboard')
    .option('--lines <n>', 'Number of log lines to capture (default 200)', '200')
    .option('--only <ids>', 'Comma-separated collector IDs to run')
    .option('--skip <ids>', 'Comma-separated collector IDs to skip')
    .option('--redact-extra <pattern...>', 'Additional regex pattern(s) to redact');

  program.parse(argv);
  const options = program.opts<CliArgs>();

  // 1. Handle --wrap mode
  if (options.wrap) {
    const lineLimit = parseInt(options.lines || '200', 10) || 200;
    const logBuffer: string[] = [];

    const handleChunk = (chunk: Buffer | string) => {
      const str = chunk.toString();
      // Stream live to user's terminal
      process.stderr.write(str);
      // Keep in circular buffer
      const newLines = str.split(/\r?\n/);
      for (const line of newLines) {
        logBuffer.push(line);
        if (logBuffer.length > lineLimit * 2) {
          logBuffer.splice(0, logBuffer.length - lineLimit);
        }
      }
    };

    try {
      // Execute command through shell so piping/arguments work naturally
      const subprocess = execa(options.wrap, {
        shell: true,
        reject: false,
        all: true,
      });

      if (subprocess.all) {
        subprocess.all.on('data', handleChunk);
      }

      const result = await subprocess;

      // If command exited successfully (code 0), produce nothing extra and pass exit 0
      if (result.exitCode === 0) {
        return 0;
      }

      // Non-zero exit -> proceed to collect pack
      const wrapBuffer = logBuffer.slice(-lineLimit).join('\n');
      return await generateAndOutput(options, { wrapBuffer, exitCode: result.exitCode });
    } catch (err: any) {
      process.stderr.write(`\n${pc.red('Error running wrapped command:')} ${err.message}\n`);
      return 1;
    }
  }

  // 2. Handle --stdin mode
  let stdinLog: string | undefined;
  if (options.stdin) {
    stdinLog = await readStdin();
  }

  return await generateAndOutput(options, { stdinLog });
}

interface ExtraContext {
  wrapBuffer?: string;
  stdinLog?: string;
  exitCode?: number;
}

async function generateAndOutput(options: CliArgs, extra: ExtraContext): Promise<number> {
  const lineLimit = parseInt(options.lines || '200', 10) || 200;
  const onlyList = options.only ? options.only.split(',').map((s) => s.trim()) : undefined;
  const skipList = options.skip ? options.skip.split(',').map((s) => s.trim()) : undefined;

  const extraPatterns: RegExp[] = [];
  if (options.redactExtra) {
    for (const pat of options.redactExtra) {
      const parsed = parseRegexPattern(pat);
      if (parsed) extraPatterns.push(parsed);
    }
  }

  const isSilentMode = Boolean(options.stdout || options.json);

  if (!isSilentMode) {
    process.stderr.write(`${pc.bold('crashpack')} ${pc.dim('· collecting…')}\n`);
  }

  const collectorStatuses: Record<string, { status: string; reason?: string }> = {};

  const pack = await createCrashPack({
    cwd: process.cwd(),
    lines: lineLimit,
    stdinLog: extra.stdinLog,
    wrapBuffer: extra.wrapBuffer,
    only: onlyList,
    skip: skipList,
    redactExtra: extraPatterns,
    onCollectorComplete: (id, status, reason) => {
      collectorStatuses[id] = { status, reason };
    },
  });

  if (!isSilentMode) {
    // Print collection status summary
    const statusItems: string[] = [];
    for (const section of pack.sections) {
      if (section.status === 'ok') {
        statusItems.push(`  ${pc.green('✓')} ${section.id}`);
      } else {
        const reasonStr = section.unavailableReason ? ` ${pc.dim(`(${section.unavailableReason})`)}` : '';
        statusItems.push(`  ${pc.dim(`- ${section.id}${reasonStr}`)}`);
      }
    }

    // Format into columns or clean rows
    process.stderr.write(statusItems.join('\n') + '\n\n');
  }

  // Handle JSON output
  if (options.json) {
    process.stdout.write(JSON.stringify(pack, null, 2) + '\n');
    return extra.exitCode ?? 0;
  }

  const markdown = renderMarkdown(pack);

  // Handle stdout output
  if (options.stdout) {
    process.stdout.write(markdown + '\n');
    return extra.exitCode ?? 0;
  }

  // Handle clipboard copy (enabled by default unless --no-clipboard)
  let copiedToClipboard = false;
  if (options.clipboard !== false) {
    try {
      await clipboardy.write(markdown);
      copiedToClipboard = true;
    } catch {
      // Gracefully fall back to file on headless / SSH environments
      copiedToClipboard = false;
    }
  }

  // Determine output file path
  let outputPath = options.out;
  if (!outputPath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    outputPath = path.join(os.tmpdir(), `crashpack-${timestamp}.md`);
  }

  try {
    fs.writeFileSync(outputPath, markdown, 'utf8');
  } catch {
    // If filesystem is read-only, fallback to stdout
    process.stdout.write(markdown + '\n');
    return extra.exitCode ?? 0;
  }

  if (!isSilentMode) {
    const clipMsg = copiedToClipboard
      ? pc.green('copied to clipboard')
      : pc.dim('clipboard unavailable');
    const redactMsg = pc.yellow(
      `${pack.redactionCount} value${pack.redactionCount === 1 ? '' : 's'} redacted`
    );
    process.stderr.write(`${clipMsg} ${pc.dim('·')} ${redactMsg}\n`);
    process.stderr.write(`${pc.cyan(outputPath)}\n`);
  }

  return extra.exitCode ?? 0;
}

// Auto-run if executed directly as script
if (process.argv[1] && (process.argv[1].endsWith('cli.js') || process.argv[1].endsWith('cli.ts'))) {
  runCli().then((code) => {
    process.exit(code);
  });
}
