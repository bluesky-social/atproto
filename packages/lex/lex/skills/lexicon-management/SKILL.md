---
name: lexicon-management
description: >
  Installing, updating, and verifying Lexicon schemas with lex install CLI.
  lexicons.json manifest, CID verification, --ci mode, --update, --no-save,
  --manifest, --lexicons flags. Recursive NSID dependency resolution.
  Covers lex install app.bsky.feed.post, lex install --update, lex install --ci.
type: core
library: '@atproto/lex'
library_version: '0.0.20'
sources:
  - 'bluesky-social/atproto:packages/lex/lex/README.md'
  - 'bluesky-social/atproto:packages/lex/lex-installer/src/lex-installer.ts'
---

# Lexicon Management

The `lex install` command fetches Lexicon schemas from the AT Protocol network,
stores them locally in a `lexicons/` directory, and tracks them in a
`lexicons.json` manifest file. The manifest records each installed Lexicon's
NSID, resolved AT URI, and content identifier (CID) so that installations are
reproducible across machines and CI environments.

## Setup

Install `@atproto/lex` as a dev dependency:

```bash
npm install --save-dev @atproto/lex
```

The package provides the `lex` CLI binary. Run `lex install` with one or more
NSIDs to fetch Lexicon schemas:

```bash
npx lex install app.bsky.feed.post
```

This creates two artifacts:

- `lexicons.json` -- manifest tracking installed Lexicons, their resolved AT
  URIs, and CIDs.
- `lexicons/` -- directory containing the fetched Lexicon JSON files, organized
  by NSID path segments (e.g., `lexicons/app/bsky/feed/post.json`).

Both artifacts must be committed to version control so that other developers and
CI can reproduce the exact same set of Lexicons.

> The `lex` binary may conflict with other programs on your system. Alternatives:
> `ts-lex`, `pnpm exec lex`, or `npx @atproto/lex`.

## Core Patterns

### Install specific Lexicons

Pass one or more NSIDs to install them and update the manifest:

```bash
lex install app.bsky.feed.post app.bsky.feed.like app.bsky.actor.profile
```

All NSID references found inside the installed Lexicon definitions are
automatically resolved and installed as dependencies. For example, installing
`app.bsky.feed.post` will also pull in `app.bsky.embed.images`,
`app.bsky.richtext.facet`, and any other schemas it references.

After installing, commit both the manifest and the lexicon files:

```bash
git add lexicons.json lexicons/
git commit -m "Install Lexicons"
```

### Restore from manifest

Running `lex install` with no NSID arguments re-installs all Lexicons listed in
the existing `lexicons.json` manifest. This is the standard way to set up a
fresh checkout:

```bash
git clone https://github.com/your-org/your-app.git
cd your-app
npm install
lex install
```

The installer reads `lexicons.json`, resolves each entry using its saved AT URI,
and writes the Lexicon JSON files into `lexicons/`. If a file already exists
locally and its CID matches, it is reused without a network fetch.

### Update installed Lexicons

The `--update` flag forces re-fetching every installed Lexicon from the network,
even if it already exists locally. Use this to pick up newer versions of schemas:

```bash
lex install --update
```

This re-resolves all NSIDs, fetches fresh copies, and updates `lexicons.json`
with the new CIDs. After updating, review and commit the changes:

```bash
git diff lexicons.json
git add lexicons.json lexicons/
git commit -m "Update Lexicons to latest versions"
```

### CI verification

The `--ci` flag verifies that the installed Lexicons match the CIDs recorded in
the manifest. If anything is out of date or missing, the command exits with an
error:

```bash
lex install --ci
```

Add this to your CI pipeline to catch cases where a developer changed Lexicons
locally but forgot to commit the updated manifest:

```yaml
# Example GitHub Actions step
- name: Verify Lexicons
  run: npx lex install --ci
```

The `--ci` flag works by: (1) reading the existing `lexicons.json` manifest,
(2) installing/restoring all Lexicons, and (3) comparing the resulting manifest
against the original. If they differ, the process throws
`"Lexicons manifest is out of date"`.

## CLI Flags Reference

| Flag               | Default          | Description                                          |
|--------------------|------------------|------------------------------------------------------|
| `--manifest <path>`| `./lexicons.json`| Path to the manifest file                            |
| `--lexicons <dir>` | `./lexicons`     | Directory for Lexicon JSON files                     |
| `--no-save`        | (save is on)     | Skip writing the manifest after install              |
| `--update`         | `false`          | Re-fetch all Lexicons from the network               |
| `--ci`             | `false`          | Error if manifest does not match installed Lexicons   |

## Common Mistakes

### 1. Forgetting to commit lexicons.json manifest (HIGH)

**Wrong** -- install Lexicons locally but only commit the JSON files:

```bash
lex install app.bsky.feed.post
git add lexicons/
git commit -m "Add Lexicons"
# lexicons.json is NOT committed
```

Another developer clones the repo and runs `lex install`. Without a manifest,
the installer has no record of which NSIDs to fetch or what CIDs to expect.
Their resolved versions may differ, causing CID mismatches and broken builds.

**Correct** -- always commit both `lexicons.json` and `lexicons/`:

```bash
lex install app.bsky.feed.post
git add lexicons.json lexicons/
git commit -m "Install app.bsky.feed.post Lexicon"
```

### 2. Using lex install --ci without a saved manifest (MEDIUM)

**Wrong** -- run `--ci` in a repo that has never saved a manifest:

```bash
# First time setup, developer runs:
lex install --no-save app.bsky.feed.post

# CI pipeline runs:
lex install --ci
# ERROR: "Lexicons manifest is out of date"
# (lexicons.json does not exist or is empty)
```

The `--ci` flag reads the existing manifest and compares it to the freshly
computed state. If the manifest was never saved (or was installed with
`--no-save`), the comparison fails because there is no baseline to verify
against.

**Correct** -- always run a normal `lex install` (with save) first, commit the
manifest, then use `--ci` in pipelines:

```bash
# Developer runs:
lex install app.bsky.feed.post
git add lexicons.json lexicons/
git commit -m "Install Lexicons"
git push

# CI pipeline runs:
lex install --ci
# Success: manifest matches installed state
```

### 3. Not understanding recursive dependency resolution (MEDIUM)

**Wrong** -- assume only the explicitly named NSIDs are installed:

```bash
lex install app.bsky.feed.post
# Developer thinks only app.bsky.feed.post is installed,
# manually tries to install each dependency:
lex install app.bsky.embed.images
lex install app.bsky.embed.external
lex install app.bsky.richtext.facet
# Redundant -- these were already installed automatically
```

This is not harmful, but it clutters the manifest with explicit entries for
schemas that would have been resolved automatically as dependencies.

**Correct** -- let the installer handle dependency resolution. Only specify the
root NSIDs you actually use in your application code:

```bash
lex install app.bsky.feed.post app.bsky.feed.like
# All referenced schemas (embeds, facets, labels, etc.) are
# resolved and installed automatically as dependencies
```

Check `lexicons.json` after installation to see the full set of resolved
Lexicons and their CIDs.

## See also

- **schema-codegen** -- `lex install` must run before `lex build` to generate
  TypeScript schemas from the installed Lexicon JSON files.
