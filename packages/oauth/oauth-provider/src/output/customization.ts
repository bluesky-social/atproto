// Matches colors defined in tailwind.config.js
const colorNames = ['brand', 'error', 'warning'] as const
type ColorName = (typeof colorNames)[number]
const isColorName = (name: string): name is ColorName =>
  (colorNames as readonly string[]).includes(name)

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
  const vars = Array.from(buildCustomizationVars(customization))
  if (vars.length) return `:root { ${vars.join(' ')} }`

  return ''
}

export function* buildCustomizationVars(customization?: Customization) {
  if (customization?.colors) {
    for (const [name, value] of Object.entries(customization.colors)) {
      if (!isColorName(name)) {
        throw new TypeError(`Invalid color name: ${name}`)
      }

      // Skip undefined values
      if (value === undefined) continue

      const { r, g, b, a } = parseColor(value)

      // Tailwind does not apply alpha values to base colors
      if (a !== undefined) throw new TypeError('Alpha not supported')

      yield `--color-${name}: ${r} ${g} ${b};`
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
