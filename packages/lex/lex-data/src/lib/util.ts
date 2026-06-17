export function toHexString(number: number): string {
  return `0x${number.toString(16).padStart(2, '0')}`
}

export function isUint8(val: unknown): val is number {
  return Number.isInteger(val) && (val as number) >= 0 && (val as number) < 256
}
