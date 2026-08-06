---
'@atproto/oauth-provider': minor
'@atproto/pds': minor
---

Simplify branding color customization to match the redesigned OAuth UI. The `primary` color is now the only one that derives a contrast pair (for `--primary-foreground`); the other colors are consumed as flat values, so their per-color contrast and hue inputs no longer do anything and have been removed. `primary`, `error`, `warning`, `info` and `success` remain configurable as single RGB values.

BREAKING (`@atproto/oauth-provider`): The `errorContrast`/`errorHue`, `warningContrast`/`warningHue`, `infoContrast`/`infoHue` and `successContrast`/`successHue` options are removed from `branding.colors` (only `primaryContrast`/`primaryHue` remain). `buildCustomizationCss` now emits `--branding-color-{name}` for each configured color plus `--branding-color-primary-contrast`; it no longer emits any `--branding-color-{name}-hue`, the non-primary `--branding-color-{name}-contrast`, or the global `--contrast-sat`.

BREAKING (`@atproto/pds`): The `PDS_{ERROR,WARNING,INFO,SUCCESS}_COLOR_CONTRAST` and `PDS_{ERROR,WARNING,INFO,SUCCESS}_COLOR_HUE` environment variables are removed.
