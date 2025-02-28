import { HcaptchaConfig } from '../lib/hcaptcha.js'

// Matches colors defined in tailwind.config.js
const colorNames = ['brand', 'error', 'warning', 'success'] as const
type ColorName = (typeof colorNames)[number]

export type ColorsDefinition = {
  [_ in ColorName]?: string
}

export type LinkDefinition = {
  title: string
  href: string
  rel?: string
}

export type BrandingConfig = {
  // Aesthetic customization
  name?: string
  logo?: string
  colors?: ColorsDefinition
  links?: readonly LinkDefinition[]
}

export { type HcaptchaConfig }

export type Customization = {
  /**
   * Available user domains that can be used to sign up. A non-empty array
   * is required to enable the sign-up feature.
   */
  availableUserDomains?: string[]

  /**
   * UI customizations
   */
  branding?: BrandingConfig

  /**
   * Is an invite code required to sign up?
   */
  inviteCodeRequired?: boolean

  /**
   * Enables hCaptcha during sign-up.
   */
  hcaptcha?: HcaptchaConfig
}

export type CustomizationData = {
  // Functional customization
  hcaptchaSiteKey?: string
  inviteCodeRequired?: boolean
  availableUserDomains?: string[]

  // Aesthetic customization
  name?: string
  logo?: string
  links?: readonly LinkDefinition[]
}

export function buildCustomizationData({
  branding,
  availableUserDomains,
  inviteCodeRequired,
  hcaptcha,
}: Customization): CustomizationData {
  // @NOTE the front end does not need colors here as they will be injected as
  // CSS variables.
  // @NOTE We only copy the values explicitly needed to avoid leaking sensitive
  // data (in case the caller passed more than what we expect).
  return {
    availableUserDomains,
    inviteCodeRequired,
    hcaptchaSiteKey: hcaptcha?.siteKey,
    name: branding?.name,
    logo: branding?.logo,
    links: branding?.links,
  }
}

export function buildCustomizationCss({ branding }: Customization) {
  const vars = Array.from(buildCustomizationVars(branding))
  if (vars.length) return `:root { ${vars.join(' ')} }`

  return ''
}

function* buildCustomizationVars(branding?: BrandingConfig) {
  if (branding?.colors) {
    for (const name of colorNames) {
      const value = branding.colors[name]
      if (!value) continue

      // Skip undefined values
      if (value === undefined) continue

      const { r, g, b, a } = parseColor(value)

      // Tailwind does not apply alpha values to base colors
      if (a !== undefined) throw new TypeError('Alpha not supported')

      const contrast = computeLuma({ r, g, b }) > 128 ? '0 0 0' : '255 255 255'

      yield `--color-${name}: ${r} ${g} ${b};`
      yield `--color-${name}-c: ${contrast};`
    }
  }
}

type RgbaColor = { r: number; g: number; b: number; a?: number }
function parseColor(color: unknown): RgbaColor {
  if (typeof color !== 'string') {
    throw new TypeError(`Invalid color value: ${typeof color}`)
  }

  if (color.startsWith('#')) {
    if (color.length === 4 || color.length === 5) {
      const r = parseUi8Hex(color.slice(1, 2))
      const g = parseUi8Hex(color.slice(2, 3))
      const b = parseUi8Hex(color.slice(3, 4))
      const a = color.length > 4 ? parseUi8Hex(color.slice(4, 5)) : undefined
      return { r, g, b, a }
    }

    if (color.length === 7 || color.length === 9) {
      const r = parseUi8Hex(color.slice(1, 3))
      const g = parseUi8Hex(color.slice(3, 5))
      const b = parseUi8Hex(color.slice(5, 7))
      const a = color.length > 8 ? parseUi8Hex(color.slice(7, 9)) : undefined
      return { r, g, b, a }
    }

    throw new TypeError(`Invalid hex color: ${color}`)
  }

  const rgbMatch = color.match(
    /^\s*rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)\s*$/,
  )
  if (rgbMatch) {
    const r = parseUi8Dec(rgbMatch[1])
    const g = parseUi8Dec(rgbMatch[2])
    const b = parseUi8Dec(rgbMatch[3])
    return { r, g, b }
  }

  const rgbaMatch = color.match(
    /^\s*rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)\s*$/,
  )
  if (rgbaMatch) {
    const r = parseUi8Dec(rgbaMatch[1])
    const g = parseUi8Dec(rgbaMatch[2])
    const b = parseUi8Dec(rgbaMatch[3])
    const a = parseUi8Dec(rgbaMatch[4])
    return { r, g, b, a }
  }

  throw new TypeError(`Unsupported color format: ${color}`)
}

function computeLuma({ r, g, b }: RgbaColor) {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function parseUi8Hex(v: string) {
  return asUi8(parseInt(v, 16))
}

function parseUi8Dec(v: string) {
  return asUi8(parseInt(v, 10))
}

function asUi8(v: number) {
  if (v >= 0 && v <= 255 && v === (v | 0)) return v
  throw new TypeError(`Invalid color component: ${v}`)
}
