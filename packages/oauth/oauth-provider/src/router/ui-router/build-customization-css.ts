import { Branding } from '../../customization/branding.js'
import { COLOR_NAMES } from '../../customization/colors.js'
import { Customization } from '../../customization/customization.js'
import { extractHue, isLightColor } from '../../lib/util/color.js'

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
      if (!value) continue // Skip missing colors

      yield `--color-${name}: ${value.r} ${value.g} ${value.b};`
      yield `--color-${name}-c: ${isLightColor(value) ? '0 0 0' : '255 255 255'};`
      yield `--hue-${name}: ${extractHue(value)};`
    }
  }
}
