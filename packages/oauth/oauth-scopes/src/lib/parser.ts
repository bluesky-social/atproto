import { ScopeStringSyntax } from './syntax-string.js'
import { NeRoArray, ParamValue, ScopeSyntax } from './syntax.js'

type InferParamPredicate<T extends (value: ParamValue) => boolean> =
  T extends ((value: ParamValue) => value is infer U extends ParamValue)
    ? U
    : ParamValue

type ParamsSchema = Record<
  string,
  | {
      multiple: false
      required: boolean
      default?: ParamValue
      normalize?: (value: ParamValue) => ParamValue
      validate: (value: ParamValue) => boolean
    }
  | {
      multiple: true
      required: boolean
      default?: NeRoArray<ParamValue>
      normalize?: (value: NeRoArray<ParamValue>) => NeRoArray<ParamValue>
      validate: (value: ParamValue) => boolean
    }
>

type InferParams<S extends ParamsSchema> = {
  [K in keyof S]:
    | (S[K]['required'] extends true
        ? never
        : 'default' extends keyof S[K]
          ? S[K]['default']
          : undefined)
    | (S[K]['multiple'] extends true
        ? NeRoArray<InferParamPredicate<S[K]['validate']>>
        : InferParamPredicate<S[K]['validate']>)
} & NonNullable<unknown>

export class Parser<P extends string, S extends ParamsSchema> {
  public readonly schemaKeys: ReadonlySet<keyof S & string>

  constructor(
    public readonly prefix: P,
    public readonly schema: S,
    public readonly positionalName?: keyof S & string,
  ) {
    this.schemaKeys = new Set(Object.keys(schema))
  }

  format(values: InferParams<S>) {
    const params = new URLSearchParams()
    let positional: string | undefined = undefined

    for (const key of this.schemaKeys) {
      const value = values[key]
      // Ignore undefined values
      if (value === undefined) continue

      const schema = this.schema[key]

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

      if (Array.isArray(normalized)) {
        if (key === this.positionalName && normalized.length === 1) {
          positional = String(normalized[0]!)
        } else {
          // remove duplicates
          const unique = new Set(normalized.map(String))
          for (const v of unique) params.append(key, v)
        }
      } else {
        if (key === this.positionalName) {
          positional = String(normalized)
        } else {
          params.set(key, String(normalized))
        }
      }
    }

    return new ScopeStringSyntax(this.prefix, positional, params).toString()
  }

  // @NOTE If we needed to ever have more detailed reason as to why parsing
  // fails, this function could easily be updated to return a
  // ValidationResult<T> type that explains the reason for failure.
  parse(syntax: ScopeSyntax<P>) {
    // @NOTE no need to check prefix, since the typing (P generic) already
    // ensures it matches

    for (const key of syntax.keys()) {
      if (!this.schemaKeys.has(key)) return null
    }

    const result: Record<
      string,
      undefined | ParamValue | NeRoArray<ParamValue>
    > = Object.create(null)

    for (const key of this.schemaKeys) {
      const definition = this.schema[key]

      const param = definition.multiple
        ? syntax.getMulti(key)
        : syntax.getSingle(key)

      if (param === null) {
        return null // Value is not valid
      } else if (param !== undefined) {
        if (key === this.positionalName && syntax.positional !== undefined) {
          // Positional parameter cannot be used with named parameters
          return null
        }

        if (definition.multiple) {
          // Empty array is not valid
          if (!(param as ParamValue[]).length) return null
          if (!(param as ParamValue[]).every(definition.validate)) {
            return null
          }
        } else {
          if (!definition.validate(param as ParamValue)) {
            return null
          }
        }

        result[key] = param as ParamValue | NeRoArray<ParamValue>
      } else if (
        key === this.positionalName &&
        syntax.positional !== undefined
      ) {
        // No named parameters found, but there is a positional parameter
        const { positional } = syntax
        if (!definition.validate(positional)) {
          return null
        }
        result[key] = definition.multiple ? [positional] : positional
      } else if (definition.required) {
        return null
      } else {
        result[key] = definition.default
      }
    }

    return result as InferParams<S>
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
