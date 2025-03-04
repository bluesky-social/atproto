import { Simplify } from '../util/type.js'

export type CspValue =
  | `data:`
  | `https:${string}`
  | `'none'`
  | `'self'`
  | `'sha256-${string}'`
  | `'nonce-${string}'`
  | `'unsafe-inline'`
  | `'unsafe-eval'`
  | `'strict-dynamic'`
  | `'report-sample'`
  | `'unsafe-hashes'`

const STRING_DIRECTIVES = ['base-uri'] as const
const BOOLEAN_DIRECTIVES = [
  'upgrade-insecure-requests',
  'block-all-mixed-content',
] as const
const ARRAY_DIRECTIVES = [
  'connect-src',
  'default-src',
  'form-action',
  'frame-ancestors',
  'frame-src',
  'img-src',
  'script-src',
  'style-src',
] as const

export type CspConfig = Simplify<
  {
    [K in (typeof BOOLEAN_DIRECTIVES)[number]]?: boolean
  } & {
    [K in (typeof STRING_DIRECTIVES)[number]]?: CspValue
  } & {
    [K in (typeof ARRAY_DIRECTIVES)[number]]?: readonly CspValue[]
  }
>

const NONE = "'none'"

export function buildCsp(config: CspConfig): string {
  const values: string[] = []

  for (const name of BOOLEAN_DIRECTIVES) {
    if (config[name] === true) values.push(name)
  }

  for (const name of STRING_DIRECTIVES) {
    if (config[name]) values.push(`${name} ${config[name]}`)
  }

  for (const name of ARRAY_DIRECTIVES) {
    if (config[name]?.length) values.push(`${name} ${config[name].join(' ')}`)
  }

  return values.join('; ')
}

export function mergeCsp(a: CspConfig, b?: CspConfig): CspConfig
export function mergeCsp(a: CspConfig | undefined, b: CspConfig): CspConfig
export function mergeCsp(a?: CspConfig, b?: CspConfig): CspConfig | undefined
export function mergeCsp(a?: CspConfig, b?: CspConfig): CspConfig | undefined {
  if (!a) return b
  if (!b) return a

  const result: CspConfig = {}

  for (const name of BOOLEAN_DIRECTIVES) {
    if (a[name] || b[name]) {
      result[name] = true
    }
  }

  for (const name of STRING_DIRECTIVES) {
    if (a[name] || b[name]) {
      const aNotNone = a[name] === NONE ? undefined : a[name]
      const bNotNone = b[name] === NONE ? undefined : b[name]
      // @NOTE b takes precedence
      result[name] = bNotNone || aNotNone || NONE
    }
  }

  for (const name of ARRAY_DIRECTIVES) {
    if (a[name] && b[name]) {
      const set = new Set(a[name])
      if (b[name]) for (const value of b[name]) set.add(value)
      if (set.size > 1 && set.has(NONE)) set.delete(NONE)
      result[name] = [...set]
    } else if (a[name] || b[name]) {
      result[name] = Array.from((a[name] || b[name])!)
    }
  }

  return result
}
