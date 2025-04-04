import { CombinedTuple, Simplify } from '../util/type.js'

export type CspValue =
  | `data:`
  | `http:${string}`
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
    [K in (typeof ARRAY_DIRECTIVES)[number]]?: Iterable<CspValue>
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
    // Remove duplicate values by using a Set
    const val = config[name] ? new Set(config[name]) : undefined
    if (val?.size) values.push(`${name} ${Array.from(val).join(' ')}`)
  }

  return values.join('; ')
}

export function mergeCsp<C extends (CspConfig | null | undefined)[]>(
  ...configs: C
) {
  return configs.filter((v) => v != null).reduce(combineCsp) as CombinedTuple<C>
}

export function combineCsp(a: CspConfig, b: CspConfig): CspConfig {
  const result: CspConfig = {}

  for (const name of BOOLEAN_DIRECTIVES) {
    // @NOTE b (if defined) takes precedence
    const value = b[name] ?? a[name]
    if (value != null) result[name] = value
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
      result[name] = a[name] || b[name]
    }
  }

  return result
}
