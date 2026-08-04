import {
  type RgbColor,
  hslToRgb,
  pickContrastColor,
} from '../lib/util/color.js'
import type { Branding } from './branding.js'
import { COLOR_NAMES } from './colors.js'
import type { Customization } from './customization.js'

export function buildCustomizationCss({
  branding,
}: Customization): undefined | string {
  const vars = Array.from(buildCustomizationVars(branding))
  if (vars.length) return `:root { ${vars.join(' ')} }`
}

function* buildCustomizationVars(branding?: Branding): Generator<string> {
  if (branding?.colors) {
    for (const name of COLOR_NAMES) {
      const value = branding.colors[name]
      if (value) {
        yield `--branding-color-${name}: ${value.r} ${value.g} ${value.b};`
      }
    }

    // Only the primary colour needs a contrast pair (for --primary-foreground).
    const primary = branding.colors.primary
    if (primary) {
      const contrastSaturation = branding.colors.contrastSaturation ?? 30
      const contrastLight: RgbColor =
        branding.colors.light ??
        hslToRgb({
          h: branding.colors.primaryHue ?? 0,
          s: contrastSaturation / 100,
          l: 0.07,
        })
      const contrastDark: RgbColor =
        branding.colors.dark ??
        hslToRgb({
          h: branding.colors.primaryHue ?? 0,
          s: contrastSaturation / 100,
          l: 0.953,
        })
      const contrast =
        branding.colors.primaryContrast ??
        pickContrastColor(primary, contrastLight, contrastDark)
      yield `--branding-color-primary-contrast: ${contrast.r} ${contrast.g} ${contrast.b};`
    }
  }

  if (branding?.background) {
    const { light, dark } = branding.background
    if (light) {
      yield `--branding-background-light-image: url("${escapeCssUrl(light)}");`
    }
    if (dark) {
      yield `--branding-background-dark-image: url("${escapeCssUrl(dark)}");`
    }
  }
}

// The value is a validated URL, so escaping the two characters that could break
// out of the url("…") literal is enough.
function escapeCssUrl(url: string): string {
  return url.replace(/["\\]/g, (char) => `\\${char}`)
}
