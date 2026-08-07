---
'@atproto/oauth-provider': minor
'@atproto/pds': patch
'@atproto/dev-env': patch
---

Simplify branding color customization to match the redesigned OAuth UI. Each color is a single RGB value (`primary`, `error`, `warning`, `info`, `success`). Only `primary` gets a foreground (`--primary-foreground`), now computed automatically as black or white — whichever has the higher WCAG 2.1 contrast against `primary`. It can no longer be overridden or tuned.

BREAKING (`@atproto/oauth-provider`): The `light`, `dark`, `contrastSaturation`, and all `{name}Contrast` / `{name}Hue` options are removed from `branding.colors` (only the flat `{name}` colors remain). `buildCustomizationCss` now emits `--branding-color-{name}` for each configured color plus a computed `--branding-color-primary-contrast`; it no longer emits any `--branding-color-{name}-hue`, the non-primary `--branding-color-{name}-contrast`, or the global `--contrast-sat`. Deployments that previously set an explicit primary foreground should instead choose a `primary` color that yields the desired foreground under the WCAG contrast computation.

BREAKING (`@atproto/pds`): The `PDS_LIGHT_COLOR`, `PDS_DARK_COLOR`, `PDS_CONTRAST_SATURATION`, `PDS_{PRIMARY,ERROR,WARNING,INFO,SUCCESS}_COLOR_CONTRAST`, and `PDS_{PRIMARY,ERROR,WARNING,INFO,SUCCESS}_COLOR_HUE` environment variables are removed.
