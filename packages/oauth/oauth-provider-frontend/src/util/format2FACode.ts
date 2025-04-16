export function format2FACode(value: string) {
  const normalized = value.toUpperCase().replace(/[^A-Z2-7]/g, '')
  if (normalized.length <= 5) return normalized
  return `${normalized.slice(0, 5)}-${normalized.slice(5, 10)}`
}
