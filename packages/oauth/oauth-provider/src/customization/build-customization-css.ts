import { type RgbColor, pickContrastColor } from '../lib/util/color.js'
import type { Branding } from './branding.js'
import { COLOR_NAMES } from './colors.js'
import type { Customization } from './customization.js'

// Candidates for the primary foreground: whichever of black/white has the
// higher WCAG 2.1 contrast against the primary colour is used.
const BLACK: RgbColor = { r: 0, g: 0, b: 0 }
const WHITE: RgbColor = { r: 255, g: 255, b: 255 }

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

    // The primary colour gets a contrast pair (--primary-foreground): black or
    // white, whichever has the higher WCAG contrast against it.
    const primary = branding.colors.primary
    if (primary) {
      const contrast = pickContrastColor(primary, BLACK, WHITE)
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
