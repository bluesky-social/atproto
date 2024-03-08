const DEFAULT_COLORS = {
  primary: parseColor('#6231af')!,
}
export type BrandingColors = Record<keyof typeof DEFAULT_COLORS, string>

export type Branding = {
  logo?: string
  colors?: Partial<BrandingColors>
}

export function buildBrandingData({ logo }: Branding = {}) {
  return {
    logo,
  }
}

const DEFAULT_COLOR_ENTRIES = Object.entries(DEFAULT_COLORS)
export function buildBrandingCss({ colors = {} }: Branding = {}) {
  const vars = DEFAULT_COLOR_ENTRIES.map(([name, value]) => {
    const color = Object.hasOwn(colors, name) ? colors[name] : undefined
    const { r, g, b } = (color && parseColor(color)) || value
    // alpha not supported by tailwind (it does not work that way)
    return `--color-${name}: ${r} ${g} ${b};`
  })
  return `:root { ${vars.join(' ')} }`
}

function parseColor(
  color: string,
): undefined | { r: number; g: number; b: number; a?: number } {
  if (color.startsWith('#')) {
    if (color.length === 4 || color.length === 5) {
      const [r, g, b, a] = color
        .slice(1)
        .split('')
        .map((c) => parseInt(`${c}${c}`, 16))
      return { r, g, b, a }
    }

    if (color.length === 7 || color.length === 9) {
      const r = parseInt(color.substr(1, 2), 16)
      const g = parseInt(color.substr(3, 2), 16)
      const b = parseInt(color.substr(5, 2), 16)
      const a =
        color.length === 9 ? parseInt(color.substr(7, 2), 16) : undefined
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
