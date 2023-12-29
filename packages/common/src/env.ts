import { parseIntWithFallback } from '@atproto/common-web'

export const envInt = (name: string): number | undefined => {
  const str = process.env[name]
  return parseIntWithFallback(str, undefined)
}

export const envStr = (name: string): string | undefined => {
  const str = process.env[name]
  if (str === undefined || str.length === 0) return undefined
  return str
}

export const envBool = (name: string): boolean | undefined => {
  const str = process.env[name]
  if (str === 'true' || str === '1') return true
  if (str === 'false' || str === '0') return false
  return undefined
}

export const envList = (name: string): string[] => {
  const str = process.env[name]
  if (str === undefined || str.length === 0) return []
  return str.split(',')
}
