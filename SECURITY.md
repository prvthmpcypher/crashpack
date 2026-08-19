# Security Policy

## Supported Versions

We release security patches and pattern updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1.0 | :x:                |

---

## Security Architecture & Guarantees

`crashpack` is built on a **security-first, local-only** design model:

1. **Zero Outbound Network Calls**
   - The CLI makes zero HTTP/HTTPS requests, zero telemetry pings, and zero analytics calls.
   - All probes utilize offline local Node.js APIs (`node:os`, `node:fs`, `node:net`).
   - The guarantee that *"No data left this machine"* is an absolute architectural invariant.

2. **Mandatory Pass-Through Redaction**
   - Redaction is enforced at compile-time with TypeScript branded types (`RawText` → `SafeText`).
   - Collectors produce unredacted `RawText` that cannot reach any output sink (clipboard, file, stdout, JSON) without passing through `redact()`.
   - Pattern matching covers AWS keys, Stripe tokens, GitHub credentials, private keys (RSA/OPENSSH/EC), JWTs, database connection strings with passwords, Bearer headers, and high-entropy secrets based on standard Gitleaks definitions.

3. **Environment Value Masking**
   - When inspecting `.env` files, `crashpack` lists **key names only** (`Keys: DATABASE_URL, STRIPE_KEY`).
   - Secret values are never stored in memory or rendered in output.

---

## Reporting a Vulnerability or Pattern Bypass

If you discover a security vulnerability, architectural bypass, or an unmasked credential pattern in `crashpack`, please do **not** open a public GitHub issue.

Instead, please report it privately:

- **Email:** [poorvith007@proton.me](mailto:poorvith007@proton.me)
- **GitHub:** Use [GitHub Private Vulnerability Reporting](https://github.com/poorvith-mp/crashpack/security/advisories/new) on the repository.

### What to Include
- A description of the issue or unmasked pattern format.
- A sanitized sample snippet reproducing the bypass.
- The version of `crashpack` and Node.js runtime.

We will acknowledge receipt within 24 hours and issue a patch release promptly.
