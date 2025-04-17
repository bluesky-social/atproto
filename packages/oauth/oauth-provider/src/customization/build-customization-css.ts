import { extractHue, pickContrastColor } from '../lib/util/color.js'
import { Branding } from './branding.js'
import { COLOR_NAMES } from './colors.js'
import { Customization } from './customization.js'

export function buildCustomizationCss({
  branding,
}: Customization): undefined | string {
  const vars = Array.from(buildCustomizationVars(branding))
  if (vars.length) return `:root { ${vars.join(' ')} }`
}

function* buildCustomizationVars(branding?: Branding): Generator<string> {
  if (branding?.colors) {
    // @NOTE these could come from branding (in the future)
    const contrastLight = { r: 255, g: 255, b: 255 }
    const contrastDark = { r: 0, g: 0, b: 0 }

    for (const name of COLOR_NAMES) {
      const value = branding.colors[name]
      if (!value) continue // Skip missing colors

      const contrast = pickContrastColor(value, contrastLight, contrastDark)

      yield `--branding-color-${name}: ${value.r} ${value.g} ${value.b};`
      yield `--branding-color-${name}-contrast: ${contrast.r} ${contrast.g} ${contrast.b};`
      yield `--branding-color-${name}-hue: ${extractHue(value)};`
    }
  }
}
