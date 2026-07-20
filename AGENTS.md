# AGENTS.md

This file provides guidance to coding agents working in this repository.

## Build and Development Commands

```bash
# Install dependencies
npm install

# Run the CLI from source (tsx)
npm run dev -- auth status

# Build (outputs to bin/)
npm run build

# Run the built CLI
node bin/index.js auth status

# Regenerate the generated API types from ../esa/api/openapi.yaml
# (run when adding/using API paths not yet in src/generated/api-types.ts)
npm run update-esa-api

# Run tests
npm test              # Watch mode
npm run test:run      # Single run
npm run test:coverage # With coverage report

# Linting
npm run lint          # Check for linting issues
npm run lint:fix      # Auto-fix linting and formatting issues

# Type checking
npm run type-check    # Check TypeScript types without building

# Run the standard pre-release checks (tests, type checking, and linting)
npm run test:release
```

## Architecture Overview

This is the official command-line interface (CLI) for esa.io. It authenticates via
OAuth (Authorization Code + PKCE) and calls the esa v1 API over HTTPS. The architecture
follows a simple, command-oriented structure.

### Core Components

1. **CLI Entry Point** (`src/index.ts`): Creates the root `commander` `Command`,
   sets name/description/version, calls `registerCommands(program)`, and runs
   `program.parseAsync`. Top-level errors are printed to stderr with a non-zero exit.

2. **Commands** (`src/commands/`): One file per command group (`auth`, `user`,
   `team`, `post`, `comment`, `category`, `tag`, `member`, `attachment`, `api`,
   `config`). `commands/index.ts` aggregates registration. `api.ts` is an escape
   hatch to any v1 path.

3. **API Client** (`src/api/`): `client.ts` wraps `openapi-fetch` with auth and
   pre-request token refresh; `resolve-team.ts` resolves the target team;
   `response.ts` unwraps responses and formats errors.

4. **Auth** (`src/auth/`): OAuth (PKCE) flow, RFC 8414 discovery, and token
   storage. Tokens are saved to the OS credential store (macOS Keychain / Windows
   Credential Manager / Linux Secret Service), falling back to an AES-256-GCM
   encrypted file under `~/.config/esa-cli`.

5. **Configuration** (`src/config/index.ts`): Defines the API and OAuth config.
   `ESA_TEAM` is read by `src/api/resolve-team.ts`, and `ESA_LANG` is read by
   `src/i18n/resolve-language.ts`. `ESA_DEBUG` is read by `src/index.ts`.
   Relevant env vars:
   - `ESA_ACCESS_TOKEN`: use this access token directly instead of OAuth
   - `ESA_API_BASE_URL`: API base URL (defaults to `https://api.esa.io`); also the
     discovery source. Restricted to esa production (HTTPS) or loopback hosts.
   - `ESA_TEAM`, `ESA_LANG`, `ESA_OAUTH_SCOPE`, `ESA_OAUTH_CLIENT_ID`,
     `ESA_DEBUG`

6. **i18n** (`src/i18n/`): i18next-based messages and `--help` in English (`en`)
   and Japanese (`ja`). `en.ts` is the source of truth
   (`export type Resources = typeof en`); `ja.ts` is typed as `Resources` so key
   parity is enforced at compile time.

For the full command reference, environment variables, and project structure, see
`README.md`.

### Generated API Types (`src/generated/api-types.ts`)

The client and command files derive types from `src/generated/api-types.ts`,
generated from esa's `openapi.yaml` via `openapi-typescript`.

- Regenerate with `npm run update-esa-api` (reads `../esa/api/openapi.yaml`).
- Command files derive query/body types from `paths` rather than hand-writing them,
  e.g. `type XQuery = NonNullable<paths["/path"]["get"]["parameters"]["query"]>;`.

### Key Technical Details

- **Module System**: ES modules (`type: "module"` in package.json)
- **TypeScript**: Strict mode enabled with comprehensive type checking
- **Code Style**: Formatting, import organization, and lint rules are defined by
  `biome.json`. Run `npm run lint:fix` after editing and `npm run lint` before
  completion. Do not impose a manual import order beyond using `import type` for
  type-only imports.
- **Node Version**: Requires Node.js >= 24.18.0, npm >= 11.7.0
- **Output convention**: machine-readable data goes to stdout (usually JSON, or
  binary data for attachment downloads); human-facing messages go to stderr
- **Validate before the network**: validate input before `createEsaClient()` /
  `resolveTeam()` so bad input fails fast without an API call

## Testing Guidelines

### Test Writing Principles

When writing tests, follow these principles for maintainable and readable test code:

1. **Imports**
   - Use `import type` for type-only imports
   - Let Biome's `organizeImports` determine import ordering

2. **Mock Creation Patterns**
   - Create helper functions for complex mock objects
   - Extract repetitive mock setup into shared helper functions
   - Return mock instances from helper functions for assertion access
   - Prefer typed factories or `satisfies`; use `as unknown as` only when a minimal
     mock cannot reasonably implement a complex external type, and document why

3. **Mock Documentation**
   - Add concise comments explaining the purpose of each mock
   - Focus on WHY the mock is needed, not WHAT it does
   - Keep comments brief and directly above the mock definition

4. **Module Mocking**
   - Use `vi.mock` for ordinary static, hoisted module mocks
   - Use `vi.doMock` when a module implementation must vary between tests or the
     module must be re-imported to reset module-level state
   - Call `vi.doMock` before the dynamic import (`await import()`) it should affect
   - Undo per-test module mocks and reset the module cache during cleanup when needed

5. **Test Structure**
   - Keep each test focused on a single behavior
   - Use descriptive test names that explain the expected outcome
   - Group related tests with `describe` blocks
   - Clean up mocks in `beforeEach`/`afterEach` hooks

### Example Test Pattern

- Static module mocks and command tests: `src/commands/__tests__/attachment.test.ts`
- Per-test module replacement: `src/auth/__tests__/token-store.test.ts`
