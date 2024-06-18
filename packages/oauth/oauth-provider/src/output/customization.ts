// Matches colors defined in tailwind.config.js
const colorNames = ['primary', 'error'] as const
type ColorName = (typeof colorNames)[number]
const isColorName = (name: string): name is ColorName =>
  (colorNames as readonly string[]).includes(name)

export type FieldDefinition = {
  label?: string
  placeholder?: string
  pattern?: string
  title?: string
}

export type ExtraFieldDefinition = FieldDefinition & {
  type: 'text' | 'password' | 'date' | 'captcha'
  required?: boolean
  [_: string]: unknown
}

export type Customization = {
  name?: string
  logo?: string
  colors?: { [_ in ColorName]?: string }
  links?: Array<{
    href: string
    title: string
    rel?: string
  }>
}

export function buildCustomizationData({
  name,
  logo,
  links,
}: Customization = {}) {
  return {
    name,
    logo,
    links,
  }
}

export function buildCustomizationCss(customization?: Customization) {
  if (!customization?.colors) return ''

  const vars = Object.entries(customization.colors)
    .filter((e) => isColorName(e[0]) && e[1] != null)
    .map(([name, value]) => [name, parseColor(value)] as const)
    .filter((e): e is [ColorName, ParsedColor] => e[1] != null)
    // alpha not supported by tailwind (it does not work that way)
    .map(([name, { r, g, b }]) => `--color-${name}: ${r} ${g} ${b};`)

  return `:root { ${vars.join(' ')} }`
}

type ParsedColor = { r: number; g: number; b: number; a?: number }
function parseColor(color: string): undefined | ParsedColor {
  if (color.startsWith('#')) {
    if (color.length === 4 || color.length === 5) {
      const [r, g, b, a] = color
        .slice(1)
        .split('')
        .map((c) => parseInt(c + c, 16))
      return { r, g, b, a }
    }

    if (color.length === 7 || color.length === 9) {
      const r = parseInt(color.slice(1, 3), 16)
      const g = parseInt(color.slice(3, 5), 16)
      const b = parseInt(color.slice(5, 7), 16)
      const a = color.length > 8 ? parseInt(color.slice(7, 9), 16) : undefined
      return { r, g, b, a }
    }

    return undefined
  }

  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch
    return { r: parseInt(r, 10), g: parseInt(g, 10), b: parseInt(b, 10) }
  }

  const rgbaMatch = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*(\d+)\)/)
  if (rgbaMatch) {
    const [, r, g, b, a] = rgbaMatch
    return {
      r: parseInt(r, 10),
      g: parseInt(g, 10),
      b: parseInt(b, 10),
      a: parseInt(a, 10),
    }
  }

  return undefined
}
