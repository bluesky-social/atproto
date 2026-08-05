---
name: update-chat-lexicons
description: Use when the user wants to update, sync, or copy chat lexicons from the chat repo into this monorepo, or when they mention "update chat lexicons"
---

# Update Chat Lexicons

## Overview

Syncs chat lexicon definitions from the external chat repo into this monorepo and adds a changeset for the update.

## Steps

1. **From the atproto repository root, copy lexicons from the sibling chat repo:**

```bash
rsync -a --delete ../chat/lexicons/chat/ ./lexicons/chat/
```

2. **Regenerate dependent code from the repository root:**

```bash
pnpm codegen
```

3. **Create a changeset** by writing a new file in `.changeset/` with a random three-word name (format: `adjective-noun-verb.md`):

```markdown
---
'@atproto/api': patch
---

update chat lexicons
```

4. **Validate the affected package:**

```bash
cd packages/api
pnpm build
pnpm test
```

5. Review the copied and generated diff, then commit.

## Notes

- The source repo is at `../chat`
- The destination is `lexicons/chat/` in this repo root
- The changeset package is `@atproto/api` with a `patch` bump
- Before opening a PR, run the full checks required by `CONTRIBUTING.md`
