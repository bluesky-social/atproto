import { parseIntWithFallback } from '@atproto/common'

export const envInt = (str: string | undefined): number | undefined => {
  return parseIntWithFallback(str, undefined)
}

export const envStr = (str: string | undefined): string | undefined => {
  if (str === undefined || str.length === 0) return undefined
  return str
}

export const envBool = (str: string | undefined): boolean => {
  return str === 'true' || str === '1'
}

export const envList = (str: string | undefined): string[] => {
  if (str === undefined || str.length === 0) return []
  return str.split(',')
}
