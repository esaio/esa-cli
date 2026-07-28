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
   sets name/description/version, defines the global `--timeout <seconds>`
   option, calls `registerCommands(program)`, and runs `program.parseAsync`.
   A `preAction` hook validates `--timeout` once (`parseTimeoutMs()`) and stores
   it via `setRequestTimeoutMs()`. Top-level errors are formatted by
   `formatCliError()` (`src/cli-error.ts`) and printed to stderr with a non-zero
   exit; the stack trace is shown only when `ESA_DEBUG=1`.

2. **Commands** (`src/commands/`): One file per command group (`auth`, `user`,
   `team`, `post`, `comment`, `category`, `tag`, `member`, `attachment`,
   `feedback`, `api`, `config`). `commands/index.ts` aggregates registration.
   `api.ts` is an escape hatch to any v1 path.

3. **API Client** (`src/api/`): `client.ts` wraps `openapi-fetch` with auth and
   pre-request token refresh. There is no client-side timeout by default; when
   `--timeout` is given, `request-timeout.ts` holds the value and `client.ts`
   swaps in `fetchWithTimeout()` (`src/network/fetch.ts`) so it applies to the
   whole request. `resolve-team.ts` resolves the target team;
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

For the full command reference and environment variables, see `README.md`.

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
- **Output convention**: command results go to stdout; human-facing notes
  (confirmations, progress, "nothing found") go to stderr
- **JSON only on request**: no command emits JSON unless `--json <fields>` is
  given. `esa api` is the sole exception — it is a raw passthrough whose whole
  job is to return the API response verbatim. `attachment download` is outside
  the rule too: it streams the attachment bytes themselves to stdout.
  Everything in `src/output/` follows from that rule.
  - `printList()` — list commands. An aligned table on a TTY, tab-separated rows
    when piped. Adding a list command means defining its `Column[]`; never
    hand-roll the table, the empty case, or `--json`. Widths are display widths,
    not character counts, so Japanese and emoji stay aligned.
  - `printDetail()` — single resources. A labelled summary on a TTY,
    `key<TAB>value` lines plus a `--` separator before the body when piped.
    Bodies are emitted as raw Markdown, never rendered.
  - `printMutation()` — create/update. The URL on stdout, a `✓` line on stderr,
    so `esa post create ... > url.txt` yields just the URL. Pass `notice: true`
    when nothing changed: the symbol becomes `!` but the output shape stays the
    same, so callers need not branch on the target's state. A bad `--json` field
    name here is reported as a `!` line and the command still exits 0 — the
    change already happened, and failing would invite a retry that applies it
    twice. Read commands keep failing on a bad field: retrying those is free.
  - `printSuccess()` — a single `✓` line on stderr for actions that produce no
    URL (`post delete` / `comment delete`, `auth refresh`, `config set`,
    `feedback create`, `attachment download -o`); stdout stays empty. It takes
    only a message, so a command that wants a machine-readable result after the
    change calls `printJsonAfterChange()` itself — `auth refresh` is the only
    one that does, and the delete commands have no `--json` at all.
    `printNotice()` is its `!` counterpart for a non-failure warning.
    `auth status` keeps one human-readable form on both TTY and pipe (it reports
    state rather than returning a record) and offers `--json`.
  - `displayValue()` — substitutes a `-` for empty values, but only on the TTY
    paths, so piped output stays exactly what the API returned.
  - `singleLine()` — collapses tabs and newlines inside a cell or field value to
    a space. A tab in a comment body would otherwise read as a column break and
    a newline as a row break, so `cut -fN` would pick up the wrong field. The
    untouched value is still reachable through `--json`.
  - Colour is decided per output stream. Use `greenOnStderr`/`yellowOnStderr`
    for anything written to stderr; deciding from stdout drops the colour when
    only stdout is redirected, and leaks escapes when only stderr is.
  - `--json <fields>` projects fields on all three, taking the candidate list
    from the response itself rather than a hand-maintained list.
  - Use `displayTime()` for timestamps so the TTY/pipe split stays consistent.
- **Validate before the network**: validate input before `createEsaClient()` /
  `resolveTeam()` so bad input fails fast without an API call. The one exception
  is `--json` field names, whose candidates come from the response itself, so the
  check necessarily runs after the request. On create/update that means the
  change is already made when a bad field name is rejected; the `✓` line is
  printed to stderr before the projection so the outcome is still reported

## Project structure

```
src/
  index.ts               # CLI entry point (commander, global --timeout)
  cli-error.ts           # Top-level error message (stack trace only on ESA_DEBUG)
  commands/              # Subcommand definitions
    index.ts             # Aggregates command registration
    auth.ts              # `esa auth` commands (login/logout/refresh/status)
    user.ts              # `esa user`
    team.ts              # `esa team` commands (list/stats)
    post.ts              # `esa post` commands (list/search/view/backlinks/revisions/create/update/append/prepend/archive/duplicate/rollback/delete)
    comment.ts           # `esa comment` commands (list/view/create/update/delete)
    category.ts          # `esa category` commands (list)
    tag.ts               # `esa tag list` (list tags)
    member.ts            # `esa member list` (list members)
    attachment.ts        # `esa attachment` commands (upload/sign/download)
    feedback.ts          # `esa feedback create` (send feedback to esa.io)
    api.ts               # `esa api` escape hatch to any path
    body-input.ts        # Body input (--body / --body-file / stdin)
    confirm.ts           # y/N confirmation prompt (used by delete)
    config.ts            # `esa config set/get` (default team, language)
    parse.ts             # Shared option/argument validation (incl. --timeout)
  output/                # Output formatting
    list.ts              # Shared list rendering (columns + --json) for list commands
    detail.ts            # Shared single-resource rendering (fields + body + --json)
    mutation.ts          # Create/update result (URL on stdout, ✓/! on stderr)
    table.ts             # Aligned table on a TTY / tab-separated when piped
    stream.ts            # Whether stdout is a TTY, and the terminal width
    color.ts             # util.styleText (Node handles NO_COLOR / TTY detection)
    time.ts              # Relative time (Intl.RelativeTimeFormat)
    value.ts             # Empty-value placeholder (TTY) and single-line collapsing
    json-fields.ts       # --json field projection
  api/                   # esa API client
    client.ts            # openapi-fetch client (auth, pre-request token refresh)
    request-timeout.ts   # Per-request timeout set from the global --timeout
    resolve-team.ts      # Resolve the target team (--team / ESA_TEAM / default / sole membership)
    response.ts          # Response unwrapping and error formatting
  network/               # Low-level networking helpers
    fetch.ts             # fetch with a whole-request timeout (keeps the caller's signal)
    loopback.ts          # Loopback host check (base URL validation / OAuth discovery)
  i18n/                  # Localization (i18next)
    index.ts             # i18next init and the t() translation function
    resolve-language.ts  # Language resolution (ESA_LANG / config / OS locale)
    locales/             # Language resources (en / ja)
  auth/                  # OAuth auth and token storage
    oauth.ts             # Authorization Code + PKCE flow
    discovery.ts         # Authorization server metadata (RFC 8414)
    resolve-auth.ts      # Auth method selection (OAuth / ESA_ACCESS_TOKEN / none)
    pkce.ts              # PKCE / state generation
    callback.ts          # Loopback HTTP server
    open-browser.ts      # Launch the default browser (OS command)
    token-store.ts       # Backend selection and dispatch
    keychain.ts          # macOS Keychain
    credential-manager.ts # Windows Credential Manager
    secret-service.ts    # Linux Secret Service
    encrypted-store.ts   # Encrypted-file fallback
    machine-id.ts        # Machine-specific ID for the encrypted-file key
    types.ts             # TokenSet type
  config/                # Settings and environment variables
    index.ts
    paths.ts             # Config/token storage directories
    file-store.ts        # Config file (~/.config/esa-cli/config.json) read/write
  test-utils/            # Shared test helpers (stdout capture)
  generated/             # API types generated from openapi.yaml (npm run update-esa-api)
    api-types.ts
```

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
