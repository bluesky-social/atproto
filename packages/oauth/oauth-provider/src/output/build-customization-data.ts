import { z } from 'zod'
import { hcaptchaConfigSchema } from '../lib/hcaptcha.js'
import { isLinkRel } from '../lib/html/build-document.js'
import { multiLangStringSchema } from '../lib/locale.js'
export { type HcaptchaConfig, hcaptchaConfigSchema } from '../lib/hcaptcha.js'

// Matches colors defined in tailwind.config.js
export const colorNames = ['brand', 'error', 'warning', 'success'] as const
export const colorNameSchema = z.enum(colorNames)
export type ColorName = z.infer<typeof colorNameSchema>

const parsedColorSchema = z.string().transform((value, ctx): RgbColor => {
  try {
    const { r, g, b, a } = parseColor(value)
    if (a != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Alpha values are not supported',
      })
    }
    return { r, g, b }
  } catch (e) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: e instanceof Error ? e.message : 'Invalid color value',
    })
    // Won't actually be used (since an issue was added):
    return { r: 0, g: 0, b: 0 }
  }
})
export type ParsedColor = z.infer<typeof parsedColorSchema> // Same as RgbColor

export const colorsDefinitionSchema = z.record(
  colorNameSchema,
  parsedColorSchema.optional(),
)
export type ColorsDefinition = z.infer<typeof colorsDefinitionSchema>

export const localizedStringSchema = z.union([
  z.string(),
  multiLangStringSchema,
])
export type LocalizedString = z.infer<typeof localizedStringSchema>

export const linkRelSchema = z.string().refine(isLinkRel, 'Invalid link rel')
export type LinkRel = z.infer<typeof linkRelSchema>

export const linkDefinitionSchema = z.object({
  title: localizedStringSchema,
  href: z.string().url(),
  rel: linkRelSchema.optional(),
})
export type LinkDefinition = z.infer<typeof linkDefinitionSchema>

/**
 * Aesthetic customization
 */
export const brandingConfigSchema = z.object({
  name: z.string().optional(),
  logo: z.string().optional(),
  colors: colorsDefinitionSchema.optional(),
  links: z.array(linkDefinitionSchema).readonly().optional(),
})
export type BrandingInput = z.input<typeof brandingConfigSchema>
export type Branding = z.infer<typeof brandingConfigSchema>

export const customizationSchema = z.object({
  /**
   * Available user domains that can be used to sign up. A non-empty array
   * is required to enable the sign-up feature.
   */
  availableUserDomains: z.array(z.string()).optional(),
  /**
   * UI customizations
   */
  branding: brandingConfigSchema.optional(),
  /**
   * Is an invite code required to sign up?
   */
  inviteCodeRequired: z.boolean().optional(),
  /**
   * Enables hCaptcha during sign-up.
   */
  hcaptcha: hcaptchaConfigSchema.optional(),
})
export type CustomizationInput = z.input<typeof customizationSchema>
export type Customization = z.infer<typeof customizationSchema>

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

function* buildCustomizationVars(branding?: Branding) {
  if (branding?.colors) {
    for (const name of colorNames) {
      const value = branding.colors[name]
      if (!value) continue // Skip missing colors

      const { r, g, b } = value

      const contrast = computeLuma({ r, g, b }) > 128 ? '0 0 0' : '255 255 255'

      yield `--color-${name}: ${r} ${g} ${b};`
      yield `--color-${name}-c: ${contrast};`
    }
  }
}

type RgbColor = { r: number; g: number; b: number }
type RgbaColor = { r: number; g: number; b: number; a?: number }
function parseColor(color: string): RgbaColor {
  if (color.startsWith('#')) {
    return parseHexColor(color)
  }

  if (color.startsWith('rgba(')) {
    return parseRgbaColor(color)
  }

  if (color.startsWith('rgb(')) {
    return parseRgbColor(color)
  }

  // Should never happen (as long as the input is a validated WebColor)
  throw new TypeError(`Invalid color value: ${color}`)
}

function parseHexColor(v: string) {
  // parseInt('az', 16) does not return NaN so we need to check the format
  if (!/^#[0-9a-f]+$/i.test(v)) {
    throw new TypeError(`Invalid hex color value: ${v}`)
  }

  if (v.length === 4 || v.length === 5) {
    const r = parseUi8Hex(v.slice(1, 2))
    const g = parseUi8Hex(v.slice(2, 3))
    const b = parseUi8Hex(v.slice(3, 4))
    const a = v.length > 4 ? parseUi8Hex(v.slice(4, 5)) : undefined
    return { r, g, b, a }
  }

  if (v.length === 7 || v.length === 9) {
    const r = parseUi8Hex(v.slice(1, 3))
    const g = parseUi8Hex(v.slice(3, 5))
    const b = parseUi8Hex(v.slice(5, 7))
    const a = v.length > 8 ? parseUi8Hex(v.slice(7, 9)) : undefined
    return { r, g, b, a }
  }

  throw new TypeError(`Invalid hex color value: ${v}`)
}

function parseRgbColor(v: string) {
  const matches = v.match(/^\s*rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)\s*$/)
  if (!matches) throw new TypeError(`Invalid rgb color value: ${v}`)

  const r = parseUi8Dec(matches[1])
  const g = parseUi8Dec(matches[2])
  const b = parseUi8Dec(matches[3])
  return { r, g, b }
}

function parseRgbaColor(v: string) {
  const matches = v.match(
    /^\s*rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)\s*$/,
  )
  if (!matches) throw new TypeError(`Invalid rgba color value: ${v}`)

  const r = parseUi8Dec(matches[1])
  const g = parseUi8Dec(matches[2])
  const b = parseUi8Dec(matches[3])
  const a = parseUi8Dec(matches[4])
  return { r, g, b, a }
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
  throw new TypeError(
    `Invalid color component "${v}" (expected an integer between 0 and 255)`,
  )
}
