import { COLOR_NAMES } from '@atproto/oauth-provider-ui'
import { Branding } from '../../customization/branding.js'
import { Customization } from '../../customization/customization.js'
import { computeLuma } from '../../lib/util/color.js'

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

      const { r, g, b } = value

      const contrast = computeLuma({ r, g, b }) > 128 ? '0 0 0' : '255 255 255'

      yield `--color-${name}: ${r} ${g} ${b};`
      yield `--color-${name}-c: ${contrast};`
    }
  }
}
