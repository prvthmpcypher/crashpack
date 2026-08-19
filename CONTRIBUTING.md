# Contributing to crashpack

First off, thank you for considering contributing to `crashpack`! 

`crashpack` is designed to be a lightweight, zero-config, local-first crash context collector for developers. We welcome issues, suggestions, and pull requests that maintain these principles.

---

## Development Setup

### Prerequisites
- **Node.js**: v20.0.0 or higher
- **Git**

### Clone & Install

```bash
git clone https://github.com/poorvith-mp/crashpack.git
cd crashpack
npm install
```

### Common Commands

```bash
# Run the test suite (Vitest)
npm test

# Run tests in watch mode
npm run test:watch

# Run TypeScript typechecker
npm run typecheck

# Build ESM & CJS distribution bundles (tsup)
npm run build

# Link CLI locally for interactive testing
npm link
```

---

## Core Architectural Invariants

When adding features or modifying code, keep the following non-negotiable guarantees intact:

1. **Mandatory Redaction Pass-Through**
   - All collector outputs must return `RawText`.
   - Only `redact()` produces `SafeText`.
   - Never bypass or remove branded types in `src/types.ts`.

2. **Zero Network Calls**
   - The CLI must make **zero** outbound network requests (no telemetry, no analytics, no remote checking).
   - Use only native Node.js APIs (`node:os`, `node:fs`, `node:net`).

3. **No Direct Collector Side-Effects**
   - Collectors must be pure extraction functions.
   - Never call `fs.writeFileSync`, `clipboardy.write`, or `console.log` inside `src/collectors/`.

4. **Strict 2-Second Command Timeouts**
   - Any external probe (e.g. `git`, `docker`, `python`) must be bounded by a 2-second timeout to ensure the tool never hangs.

5. **Environment Variable Privacy**
   - Only `.env` **key names** may be listed. Secret values must **never** be read, stored, or output.

---

## Submitting a Pull Request

1. **Fork and Branch:** Create a feature branch (`git checkout -b feat/my-improvement`).
2. **Add Tests:** Ensure your changes include unit tests in the appropriate `*.test.ts` file.
3. **Verify Everything Passes:**
   ```bash
   npm run typecheck
   npm test
   npm run build
   ```
4. **Commit Conventions:** Follow [Conventional Commits](https://www.conventionalcommits.org/) (e.g., `feat:`, `fix:`, `docs:`, `test:`).
5. **Open a PR:** Open a Pull Request on GitHub describing your changes and motivation.

---

## Questions & Feedback

Feel free to open an issue on GitHub or reach out to Poorvith at [poorvith007@proton.me](mailto:poorvith007@proton.me).
