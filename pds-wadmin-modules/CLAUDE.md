# pds-wadmin-modules — Python admin CLI modules

Python modules backing the W Social PDS admin CLI (`bash-wadmin` at repo root). Handles tasks that don't fit cleanly in TypeScript: Brevo (email) automation, bulk admin operations, account lifecycle scripts.

## Stack

- Python `>=3.10`
- `requirements.txt` — runtime deps
- `pyproject.toml` — module metadata
- Brevo SDK for transactional email + lists

## Layout

```
brevo_integration.py     Top-level Brevo helpers (lists, contacts, automations)
wadmin/                  CLI module package (commands invoked via bash-wadmin)
requirements.txt
pyproject.toml
README.md
```

## Related entry points (repo root)

- `bash-wadmin` — bash wrapper that activates a venv and dispatches commands
- `pds-wadmin-dev`, `pds-wadmin-stage`, `pds-wadmin-prod` — environment-specific shims pointing at the right PDS URL + secrets

## Conventions

- Keep TypeScript logic in `packages/pds/`; only put things here that are inherently Python (Brevo SDK, data-processing scripts, CSV munging).
- All credentials come from env vars / SOPS-decrypted files. No secrets in this directory.
- New CLI commands go under `wadmin/` as submodules; mirror the pattern of existing ones.

## See also

- `.claude/docs/wadmin/python-modules.md` — deeper guide + Brevo specifics
