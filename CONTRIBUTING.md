# Contributing

> While we do accept contributions, we prioritize high quality issues and pull requests. Adhering to the below guidelines will ensure a more timely review.

> [!IMPORTANT]
>
> **Found a security vulnerability?** Don't open an issue or a PR. Email `security@bsky.app` instead — see [SECURITY.md](./SECURITY.md). We acknowledge reports within 3 business days, and with your consent we'll add you to [CONTRIBUTORS.md](./CONTRIBUTORS.md).

**Rules:**

- We may not respond to your issue or PR.
- We may close an issue or PR without much feedback.
- We may lock discussions or contributions if our attention is getting DDOSed.
- We do not provide support for build issues.

**Guidelines:**

- Check for existing issues before filing a new one, please.
- Open an issue and give some time for discussion before submitting a PR.
- If submitting a PR that includes a lexicon change, please get sign off on the lexicon change _before_ doing the implementation.
- Issues are for bugs & feature requests related to the TypeScript implementation of atproto and related services.
  - For high-level discussions, please use the [Discussion Forum](https://github.com/bluesky-social/atproto/discussions).
  - For client issues, please use the relevant [social-app](https://github.com/bluesky-social/social-app) repo.
- Stay away from PRs that:
  - Refactor large parts of the codebase
  - Add entirely new features without prior discussion
  - Change the tooling or frameworks used without prior discussion
  - Introduce new unnecessary dependencies

Remember, we serve a wide community of users. Our day-to-day involves us constantly asking "which top priority is our top priority." If you submit well-written PRs that solve problems concisely, that's an awesome contribution. Otherwise, as much as we'd love to accept your ideas and contributions, we really don't have the bandwidth.

## Developer Quickstart

Node.js 22 is the minimum supported version; the version in [.nvmrc](./.nvmrc) is what we develop and test against. Install [`nvm`](https://github.com/nvm-sh/nvm) to manage Node.js installs, then pick that version up from the repo root:

```bash
nvm install
nvm use
```

`pnpm` manages the workspace, and is itself managed by [Corepack](https://nodejs.org/api/corepack.html) so that everyone runs the version pinned in [package.json](./package.json). Corepack ships with Node.js — enable it, then let it install `pnpm`:

```bash
corepack enable
corepack install
```

From there, install dependencies and build every package:

```bash
pnpm install
pnpm build
```

Once built, `pnpm dev` runs a full local stack — a PDS, an AppView, a PLC directory, an Ozone instance and a bsync service, seeded with fake test accounts and data. It runs against the compiled output, so pair it with `pnpm dev:ts` in a second terminal to rebuild as you edit. This requires [Docker](https://docs.docker.com/get-started/get-docker/) and `jq` for the postgres and redis containers.

```bash
pnpm dev
```

The stack prints the URL of every service it starts. The seeded accounts all live on the PDS, and you can sign in as any of them:

| Handle       | Password  |
| ------------ | --------- |
| `alice.test` | `hunter2` |
| `bob.test`   | `hunter2` |
| `carla.test` | `hunter2` |

The seed data is regenerated from scratch on every run, so feel free to break things.

## Working in this codebase

**Code style is documented in [STYLE_GUIDE.md](./STYLE_GUIDE.md)** — read it before writing code. It covers imports, typing, dependencies, and the scope of a change. PRs that ignore it will be sent back.

Beyond style, two things are worth calling out up front: don't change tooling or frameworks without prior discussion, and don't add dependencies without strong justification.

**Adding a package.** Declare a `files` field in its `package.json` listing everything the package needs at runtime — usually `./dist` and `./CHANGELOG.md`. The service images are built with `pnpm deploy`, which copies each workspace dependency according to that field, as `npm pack` would. `pnpm verify` fails if a package the services depend on has no `files` field, but nothing checks that the list is complete: a list that misses a runtime asset builds fine, then breaks the services (and npm consumers) at runtime.

**Before opening the PR**

- **The project must build and pass verification.** Run this from the repo root and make sure it comes back clean:

  ```bash
  pnpm build --force && pnpm verify
  ```

- **The test suite must pass**, and new behavior must be covered by tests. Bug fixes need a test that fails before the fix and passes after it; new features need tests for the paths they add. Run the tests with `pnpm test` from the repo root, or from inside the package you changed for a faster loop. Some suites (`bsky`, `pds`, `ozone`) need Docker for postgres and redis — go through `pnpm test` rather than invoking vitest or jest directly, so the infra gets started for you.

- Every package your change touches needs a changeset entry under [.changeset/](./.changeset/) — `minor` for breaking changes or new public API, `patch` otherwise. Dependency-only bumps are generated for you; don't list them by hand.

- If your change introduces, alters, or removes a documented pattern, update [AGENTS.md](./AGENTS.md) and the skills under `.agents/skills/` in the same PR. Agent files are part of the codebase and must stay in sync with it.

## Working with lexicons

Lexicon NSIDs used in this repository have different sources:

- This repository contains the canonical source for the `com.atproto.*` and `tools.ozone.*` lexicon namespaces.
- Published on the AT Protocol network:
  - `app.bsky.*` and `chat.bsky.*` are defined in the [`bsky` repository](https://github.com/bluesky-social/bsky), and automatically published on the AT Protocol network from there.
  - `site.standard.*`, `social.grain.*`, etc. lexicons are published on the AT Protocol network.
- Some lexicons are not published on the AT Protocol network
  - `internal.*`
  - `app.bsky.unspecced.*` (fetched from the [`bsky` repository](https://github.com/bluesky-social/bsky))
- Some lexicons are missing on the AT Protocol network (at the time of writing)
  - `place.stream.badge.defs`

The repository root `lexicons` directory holds **only** the canonical `com.atproto.*` and `tools.ozone.*` namespaces. Every package that works with lexicon documents defines its own lexicon manifest (`lexicons.json`), which acts as a "source of truth" for the lexicons it uses (similar to `package.json` for NPM modules). Packages no longer compile the root `lexicons` directory directly.

> [!NOTE]
>
> One package is an exception: [`@atproto/lex-resolver`](./packages/lex/lex-resolver) has no `lexicons.json` and still compiles the canonical schemas straight from the root `lexicons` directory (`lex-builder build --lexicons ../../../lexicons --include …`). It sits inside `@atproto/lex-installer`'s own dependency tree, so it cannot depend on the installer to manage a manifest without creating a dependency cycle. See [its AGENTS.md](./packages/lex/lex-resolver/AGENTS.md).

A package's `lexicons.json` lists its lexicons and an ordered `resolvers` array describing where each one comes from. The typical setup is:

- a `directory` resolver pointing at the root `lexicons` directory, scoped to `com.atproto.*` / `tools.ozone.*` (these are **symlinked** into the package's `./lexicons`, so they can't drift from the canonical source);
- for `app.bsky.*` / `chat.bsky.*`, an `http` resolver pointing at the [`bsky` repository](https://github.com/bluesky-social/bsky) raw lexicons;
- the AT Protocol network (the implicit last fallback) for other published namespaces (`site.standard.*`, `social.grain.*`, …);
- a `directory` resolver pointing at the shared, committed repo-root [`lexicons-overrides`](./lexicons-overrides) directory, listed **after** the canonical resolver but before the network ones, so it overrides the lexicons that would otherwise be resolved from the `bsky` repo or the network (it cannot override the canonical lexicons, which resolve first). This holds any document that must differ locally — unpublished lexicons (e.g. `internal.*`, `place.stream.badge.defs`) and documents whose local version is ahead of what the resolvers would otherwise return.

New lexicon dependencies can be added to a package by running `pnpm lex:install new.nsid.to.install` from the package root; `pnpm lex:update` refreshes them.

When building, each package runs `pnpm run lex:install --ci` as part of its `prebuild`. This resolves every lexicon the manifest lists into the package's `./lexicons` directory and fails if any installed document does not match the CID recorded in `lexicons.json`.

Only the generated TypeScript (`src/lexicons`) and the canonical schemas symlinked from the repo root (`com.atproto.*` / `tools.ozone.*`) are gitignored. Every other document resolved into a package's `./lexicons` directory — the `at://` network copies and the `app.bsky.*` / `chat.bsky.*` documents fetched from the `bsky` repo — is committed to the package for offline builds, since AT Protocol does not allow fetching older versions of records and relying on a live fetch would break CI whenever an external lexicon changes or is temporarily unavailable. The shared repo-root `lexicons-overrides` directory is always committed too.

### Updating Lexicons

Updating a canonical lexicon document (`com.atproto.*` or `tools.ozone.*`) in this repository requires running `pnpm lex:update-local` from the repository root. This re-resolves the canonical lexicons in every package that depends on them, propagating the new CID into each package's `lexicons.json`.

Updating an external lexicon document (not `com.atproto.*` or `tools.ozone.*`) should be done by running `pnpm lex:update` from the package that owns the lexicon. This will fetch the latest version of the lexicon and update the package's `lexicons.json` manifest accordingly.

Updating every lexicon document across the repository can be done by running `pnpm lex:update` from the repository root, which runs each package's own `lex:update` in turn.

## LLM-assisted contributions

Contributions written with the help of an LLM or coding agent are welcome, under three conditions.

**Disclose it.** Say so in the pull request description, and name the tooling you used. We are not going to reject a PR for being agent-assisted, but reviewers calibrate differently depending on how code was produced, and discovering it after the fact costs trust.

**Follow [AGENTS.md](./AGENTS.md), whatever agent you use.** It contains this repository's agent directives. If your agent reads a different configuration file, mirror the relevant rules into it, or feed `AGENTS.md` in as context. A PR that violates these conventions gets the same treatment whether a person or a model wrote it.

**Own every line.** You are the author of the patch, not a courier for your agent's output. Before you open the PR, read the whole diff and make sure you can explain why each change is there, that it does what the description claims, and that it doesn't drag in unrelated edits, invented APIs, or unnecessary dependencies. Expect review questions and be able to answer them yourself. "The model generated it" is not an answer, and unreviewed agent output — plausible-looking code that nobody has actually vetted — costs us more time than it saves.
