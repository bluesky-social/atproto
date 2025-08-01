import { NeRoArray, ResourceSyntax, ScopeForResource } from './syntax.js'

type InferStringPredicate<T extends undefined | ((value: string) => boolean)> =
  T extends ((value: string) => value is infer U extends string) ? U : string

type ParamsSchema = Record<
  string,
  | {
      multiple: false
      required: boolean
      default?: string
      normalize?: (value: string) => string
      validate?: (value: string) => boolean
    }
  | {
      multiple: true
      required?: boolean
      default?: NeRoArray<string>
      normalize?: (value: NeRoArray<string>) => NeRoArray<string>
      validate?: (value: string) => boolean
    }
>

type ParsedParams<S extends ParamsSchema> = {
  [K in keyof S]:
    | (S[K]['required'] extends true
        ? never
        : 'default' extends keyof S[K]
          ? S[K]['default']
          : undefined)
    | (S[K]['multiple'] extends true
        ? NeRoArray<InferStringPredicate<S[K]['validate']>>
        : InferStringPredicate<S[K]['validate']>)
} & NonNullable<unknown>

/**
 *
 * @__NO_SIDE_EFFECTS__
 */
export class Parser<R extends string, S extends ParamsSchema> {
  readonly schemaKeys: ReadonlyArray<keyof S & string>

  constructor(
    readonly resource: R,
    readonly schema: S,
    readonly positionalName?: keyof S & string,
  ) {
    this.schemaKeys = Object.keys(schema)
  }

  format(values: ParsedParams<S>): ScopeForResource<R> {
    // Build params
    const params: [
      name: string,
      value: undefined | string | NeRoArray<string>,
    ][] = []

    for (const key of this.schemaKeys) {
      const value = values[key]
      // Ignore undefined values
      if (value === undefined) continue

      const schema = this.schema[key]

      // @TODO: when the value is an array, we could remove duplicates

      // Normalize the value if a normalization function is provided
      const normalized = schema.normalize
        ? schema.normalize(value as any)
        : value

      // Ignore values that are equal to the default value
      if (!schema.required) {
        if (schema.default === normalized) continue
        if (
          schema.multiple &&
          schema.default &&
          arrayParamEquals(schema.default, normalized as NeRoArray<string>)
        ) {
          continue
        }
      }

      params.push([key, normalized])
    }

    return formatScope<R>(this.resource, params, this.positionalName)
  }

  parse(syntax: ResourceSyntax) {
    if (!syntax.is(this.resource)) return null
    if (syntax.containsParamsOtherThan(this.schemaKeys)) return null

    const result: Record<string, undefined | string | NeRoArray<string>> =
      Object.create(null)

    for (const key of this.schemaKeys) {
      const definition = this.schema[key]

      const value = definition.multiple
        ? syntax.getMulti(key, key === this.positionalName)
        : syntax.getSingle(key, key === this.positionalName)

      if (value === null) return null // Value is not valid
      if (value === undefined && definition.required) return null

      if (value !== undefined && definition.validate) {
        if (definition.multiple) {
          if (!(value as NeRoArray<string>).every(definition.validate)) {
            return null
          }
        } else {
          if (!definition.validate(value as string)) {
            return null
          }
        }
      }

      result[key] = value ?? definition.default
    }

    return result as ParsedParams<S>
  }

  parseString(scope: string): ParsedParams<S> | null {
    const syntax = ResourceSyntax.fromString(scope)
    return this.parse(syntax)
  }
}

/**
 * Two param arrays are considered equal if they contain the same values,
 * regardless of the order and duplicates.
 * @param a - The first array to compare.
 * @param b - The second array to compare.
 */
function arrayParamEquals(
  a: readonly unknown[],
  b: readonly unknown[],
): boolean {
  for (const item of a) if (!b.includes(item)) return false
  for (const item of b) if (!a.includes(item)) return false
  return true
}

export function knownValuesValidator<T extends string>(values: Iterable<T>) {
  const set = new Set<string>(values)
  return (value: string): value is T => set.has(value)
}

/**
 * Format a scope string for a resource with parameters
 * as a positional parameter, if possible (if it has only one value).
 * @param resource - The resource name (e.g. `rpc`, `repo`, etc.)
 * @param params - The list of parameters.
 * @param positionalName - The name of the parameter that should be used as
 * positional parameter.
 */
export function formatScope<R extends string>(
  resource: R,
  params: Iterable<
    [name: string, value: undefined | string | NeRoArray<string>]
  >,
  positionalName?: string,
): ScopeForResource<R> {
  const queryParams = new URLSearchParams()

  let positionalValue: string | undefined = undefined

  for (const [name, value] of params) {
    if (value === undefined) continue

    const setPositional =
      name === positionalName && positionalValue === undefined

    if (typeof value === 'string') {
      if (setPositional) {
        positionalValue = value
      } else {
        queryParams.append(name, value)
      }
    } else {
      // value is "readonly [string, ...string[]]"
      if (value.length === 0) {
        // This should never happen (because "value" is supposed to be a
        // non-empty array). Because some scope default to "*" (allow
        // everything) when a parameter is not specified, we'd rather be safe
        // here.
        throw new Error(
          `Invalid scope: parameter "${name}" cannot be an empty array`,
        )
      } else if (setPositional && value.length === 1) {
        positionalValue = value[0]!
      } else {
        for (const v of value) {
          queryParams.append(name, v)
        }
      }
    }
  }

  // Fool-proof: If the input iterable defines multiple times the same
  // positional parameter (name), and it ended up being used as both positional
  // and query param, move the positional value to the query params.
  if (positionalValue !== undefined && queryParams.has(positionalName!)) {
    queryParams.append(positionalName!, positionalValue)
    positionalValue = undefined
  }

  let scope: ScopeForResource<R> = resource
  if (positionalValue !== undefined) {
    scope = `${scope}:${decodeAllowedChars(encodeURIComponent(positionalValue))}`
  }
  if (queryParams.size > 0) {
    scope = `${scope}?${decodeAllowedChars(queryParams.toString())}`
  }
  return scope
}

const ALLOWED_CHARS = Object.freeze([
  ':',
  '/',
  '+',
  ',',
  '@',
  '%',
  '?',
  '&',
] as const)

function decodeAllowedChars(value: string): string {
  for (const c of ALLOWED_CHARS) {
    value = value.replaceAll(encodeURIComponent(c), c)
  }
  return value
}
