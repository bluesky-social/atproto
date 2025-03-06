import { useEffect, useState } from 'react'

export const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
export const LOWER = UPPER.toLowerCase() as Lowercase<typeof UPPER>
export const DIGITS = '0123456789'

export const ALPHANUMERIC = `${UPPER}${LOWER}${DIGITS}` as const

export type UseRandomStringOptions = BuildRandomStringOptions & {
  prefix?: string
  suffix?: string
}

export function useRandomString(options?: UseRandomStringOptions) {
  const [state, setState] = useState(() => buildRandomString(options))
  useEffect(() => {
    setState(buildRandomString(options))
  }, [options?.length, options?.alphabet])

  return `${options?.prefix ?? ''}${state}${options?.suffix ?? ''}`
}

type BuildRandomStringOptions = {
  length?: number
  alphabet?: string
}

function buildRandomString({
  length = 16,
  alphabet = ALPHANUMERIC,
}: BuildRandomStringOptions = {}) {
  return Array.from({ length }, () => getRandomCharFrom(alphabet)).join('')
}

function getRandomCharFrom(alphabet: string) {
  return alphabet.charAt((Math.random() * alphabet.length) | 0)
}
