/**
 * Secret detection regex patterns referenced from standard gitleaks rules.
 */

export interface PatternRule {
  id: string;
  regex: RegExp;
  replacement?: string | ((match: string, ...args: any[]) => string);
}

export const SECRET_PATTERNS: PatternRule[] = [
  // Multi-line Private Keys (RSA, OPENSSH, EC, DSA, PGP, etc.)
  {
    id: 'private-key',
    regex: /-----BEGIN\s+[A-Z0-9_\s-]+PRIVATE KEY-----[\s\S]*?-----END\s+[A-Z0-9_\s-]+PRIVATE KEY-----/g,
    replacement: '[redacted private key]',
  },
  // AWS Access Key ID
  {
    id: 'aws-access-key',
    regex: /\b(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}\b/g,
    replacement: '[redacted]',
  },
  // Stripe API Keys (secret, publishable, restricted for live & test)
  {
    id: 'stripe-key',
    regex: /\b(?:sk|pk|rk)_(?:live|test)_[0-9a-zA-Z_]{6,}\b/g,
    replacement: '[redacted]',
  },
  // GitHub Personal Access Tokens, OAuth, Refresh, and App Tokens
  {
    id: 'github-token',
    regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{6,255}\b|\bgithub_pat_[A-Za-z0-9_]{10,255}\b/g,
    replacement: '[redacted]',
  },
  // JWT Tokens (3 base64url encoded parts starting with eyJ)
  {
    id: 'jwt',
    regex: /\beyJ[A-Za-z0-9-_]{8,}\.[A-Za-z0-9-_]{8,}\.[A-Za-z0-9-_]{8,}\b/g,
    replacement: '[redacted]',
  },
  // Connection strings with embedded credentials (including empty username like redis://:password@host)
  {
    id: 'connection-string-credentials',
    regex: /((?:postgres|postgresql|mysql|mongodb|mongodb\+srv|redis|rediss|amqp|amqps|couchdb|neo4j|mssql|cassandra):\/\/[^\s@\/:]*:)([^@\s\/]+)(@[^\s\/]+)/g,
    replacement: (_match: string, p1: string, _p2: string, p3: string) => `${p1}[redacted]${p3}`,
  },
  // Bearer tokens in headers or logs
  {
    id: 'bearer-token',
    regex: /\bBearer\s+[A-Za-z0-9\-._~+/]{6,}=*/gi,
    replacement: 'Bearer [redacted]',
  },
  // Sensitive key assignments in env/config/JSON (e.g. STRIPE_SECRET_KEY=..., "password": "...", API_TOKEN = ...)
  {
    id: 'sensitive-key-assignment',
    regex: /((?:^|[\s,;{(\[`])['"]?[A-Za-z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|KEY|CREDENTIAL|AUTH|PRIVATE|APIKEY|API_KEY)[A-Za-z0-9_]*['"]?\s*[:=]\s*)(?:'[^']*'|"[^"]*"|`[^`]*`|Bearer\s+(?:\[redacted[^\]]*\]|\S+)|\[redacted[^\]]*\]|[^\s,;{(\[`'"}\]]+)/gim,
    replacement: (_match: string, prefix: string) => {
      // If the matched key is just the English label "Keys:" in summary lists, don't redact
      if (/^\s*Keys\s*:\s*$/i.test(prefix.trim())) {
        return _match;
      }
      if (_match.includes('[redacted')) {
        return _match;
      }
      if (/\bBearer\s+/i.test(_match)) {
        return `${prefix}Bearer [redacted]`;
      }
      return `${prefix}[redacted]`;
    },
  },
  // Slack Tokens
  {
    id: 'slack-token',
    regex: /\bxox[baprs]-[0-9a-zA-Z-]{10,}\b/g,
    replacement: '[redacted]',
  },
  // NPM Access Tokens
  {
    id: 'npm-token',
    regex: /\bnpm_[A-Za-z0-9]{36}\b/g,
    replacement: '[redacted]',
  },
  // Generic high-entropy hex strings (32-64 characters in key/secret context)
  {
    id: 'generic-hex-secret',
    regex: /(?<=(?:secret|key|token|auth|signature|hash)["']?\s*[:=]\s*["']?)[a-fA-F0-9]{32,64}(?=["'\s,;]|$)/gi,
    replacement: '[redacted]',
  },
];
