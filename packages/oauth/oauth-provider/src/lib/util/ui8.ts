export function parseUi8Hex(v: string) {
  return asUi8(parseInt(v, 16))
}

export function parseUi8Dec(v: string) {
  return asUi8(parseInt(v, 10))
}

export function asUi8(v: number) {
  if (v >= 0 && v <= 255 && Number.isInteger(v)) return v
  throw new TypeError(
    `Invalid value "${v}" (expected an integer between 0 and 255)`,
  )
}
