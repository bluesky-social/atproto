---
name: update-chat-lexicons
description: Use when the user wants to update, sync, or copy chat lexicons from the chat repo into this monorepo, or when they mention "update chat lexicons"
---

# Update Chat Lexicons

## Overview

Syncs chat lexicon definitions from the external chat repo into this monorepo and adds a changeset for the update.

## Steps

1. **Copy lexicons from the chat repo:**

```bash
rsync -a --delete ../chat/lexicons/chat/ ./atproto/lexicons/chat/
```

2. **Create a changeset** by writing a new file in `.changeset/` with a random three-word name (format: `adjective-noun-verb.md`):

```markdown
---
'@atproto/api': patch
---

update chat lexicons
```

3. Commit.

## Notes

- The source repo is at `../chat`
- The destination is `lexicons/chat/` in this repo root
- The changeset package is `@atproto/api` with a `patch` bump
