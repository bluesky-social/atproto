import { extractHue, pickContrastColor } from '../lib/util/color.js'
import { Branding } from './branding.js'
import { COLOR_NAMES, contrastColorName, hueColorName } from './colors.js'
import { Customization } from './customization.js'

export function buildCustomizationCss({
  branding,
}: Customization): undefined | string {
  const vars = Array.from(buildCustomizationVars(branding))
  if (vars.length) return `:root { ${vars.join(' ')} }`
}

function* buildCustomizationVars(branding?: Branding): Generator<string> {
  if (branding?.colors) {
    const contrastLight = branding.colors.light ?? { r: 255, g: 255, b: 255 }
    const contrastDark = branding.colors.dark ?? { r: 0, g: 0, b: 0 }

    for (const name of COLOR_NAMES) {
      const value = branding.colors[name]
      if (!value) continue // Skip missing colors

      const contrast =
        branding.colors[contrastColorName(name)] ??
        pickContrastColor(value, contrastLight, contrastDark)

      const hue = branding.colors[hueColorName(name)] ?? extractHue(value)

      yield `--branding-color-${name}: ${value.r} ${value.g} ${value.b};`
      yield `--branding-color-${name}-contrast: ${contrast.r} ${contrast.g} ${contrast.b};`
      yield `--branding-color-${name}-hue: ${hue};`
    }
  }
}
