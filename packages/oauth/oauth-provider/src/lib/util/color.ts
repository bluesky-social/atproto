import { parseUi8Dec, parseUi8Hex } from './ui8.js'

export type RgbColor = { r: number; g: number; b: number }
export type RgbaColor = { r: number; g: number; b: number; a: number }

export function parseColor(color: string): RgbColor | RgbaColor {
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

export function parseHexColor(v: string): RgbColor | RgbaColor {
  // parseInt('az', 16) does not return NaN so we need to check the format
  if (!/^#[0-9a-f]+$/i.test(v)) {
    throw new TypeError(`Invalid hex color value: ${v}`)
  }

  if (v.length === 4 || v.length === 5) {
    const r = parseUi8Hex(v[1].repeat(2))
    const g = parseUi8Hex(v[2].repeat(2))
    const b = parseUi8Hex(v[3].repeat(2))
    const a = v.length > 4 ? parseUi8Hex(v[4].repeat(2)) : undefined
    return a == null ? { r, g, b } : { r, g, b, a }
  }

  if (v.length === 7 || v.length === 9) {
    const r = parseUi8Hex(v.slice(1, 3))
    const g = parseUi8Hex(v.slice(3, 5))
    const b = parseUi8Hex(v.slice(5, 7))
    const a = v.length > 8 ? parseUi8Hex(v.slice(7, 9)) : undefined
    return a == null ? { r, g, b } : { r, g, b, a }
  }

  throw new TypeError(`Invalid hex color value: ${v}`)
}

export function parseRgbColor(v: string): RgbColor {
  const matches = v.match(/^\s*rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)\s*$/)
  if (!matches) throw new TypeError(`Invalid rgb color value: ${v}`)

  const r = parseUi8Dec(matches[1])
  const g = parseUi8Dec(matches[2])
  const b = parseUi8Dec(matches[3])
  return { r, g, b }
}

export function parseRgbaColor(v: string): RgbaColor {
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

export function computeLuma({ r, g, b }: RgbColor) {
  return 0.299 * r + 0.587 * g + 0.114 * b
}
