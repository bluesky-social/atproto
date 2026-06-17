import {
  RgbColor,
  extractHue,
  hslToRgb,
  pickContrastColor,
} from '../lib/util/color.js'
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
    const contrastSaturation = branding.colors.contrastSaturation ?? 30
    yield `--contrast-sat: ${contrastSaturation.toFixed(2)}%;`

    const contrastLight: RgbColor =
      branding.colors.light ??
      // Corresponds to color-contrast-975
      hslToRgb({
        h: branding.colors.primaryHue ?? 0,
        s: contrastSaturation / 100,
        l: 0.07,
      })
    const contrastDark: RgbColor =
      branding.colors.dark ??
      // Corresponds to color-contrast-25
      hslToRgb({
        h: branding.colors.primaryHue ?? 0,
        s: contrastSaturation / 100,
        l: 0.953,
      })

    for (const name of COLOR_NAMES) {
      const value = branding.colors[name]
      if (!value) continue // Skip missing colors

      const contrast =
        branding.colors[`${name}Contrast`] ??
        pickContrastColor(value, contrastLight, contrastDark)

      const hue = branding.colors[`${name}Hue`] ?? extractHue(value)

      yield `--branding-color-${name}: ${value.r} ${value.g} ${value.b};`
      yield `--branding-color-${name}-contrast: ${contrast.r} ${contrast.g} ${contrast.b};`
      yield `--branding-color-${name}-hue: ${hue};`
    }
  }
}
