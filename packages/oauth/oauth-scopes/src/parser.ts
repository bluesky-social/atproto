import {
  NeRoArray,
  ParamValue,
  ScopeSyntax,
  ScopeSyntaxFor,
  encodeScope,
} from './syntax.js'

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
  public readonly schemaKeys: ReadonlyArray<keyof S & string>

  constructor(
    public readonly prefix: P,
    public readonly schema: S,
    public readonly positionalName?: keyof S & string,
  ) {
    this.schemaKeys = Object.keys(schema)
  }

  format(values: InferParams<S>): ScopeSyntaxFor<P> {
    const queryParams = new URLSearchParams()
    let positionalValue: string | undefined = undefined

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

      if (normalized === undefined) continue

      if (Array.isArray(normalized)) {
        if (normalized.length === 0) {
          // This should never happen (because "value" is supposed to be a
          // non-empty array). Because some scope default to "*" (allow
          // everything) when a parameter is not specified, we'd rather be safe
          // here.
          throw new Error(
            `Invalid scope: parameter "${name}" cannot be an empty array`,
          )
        }

        if (key === this.positionalName && normalized.length === 1) {
          positionalValue = String(normalized[0]!)
        } else {
          for (const v of normalized) queryParams.append(key, String(v))
        }
      } else {
        if (key === this.positionalName) {
          positionalValue = String(normalized)
        } else {
          queryParams.set(key, String(normalized))
        }
      }
    }

    return encodeScope<P>(this.prefix, positionalValue, queryParams)
  }

  parse(syntax: ScopeSyntax) {
    if (!syntax.is(this.prefix)) return null
    if (syntax.containsParamsOtherThan(this.schemaKeys)) return null

    const result: Record<
      string,
      undefined | ParamValue | NeRoArray<ParamValue>
    > = Object.create(null)

    for (const key of this.schemaKeys) {
      const definition = this.schema[key]

      const value = definition.multiple
        ? syntax.getMulti(key, key === this.positionalName)
        : syntax.getSingle(key, key === this.positionalName)

      if (value === null) return null // Value is not valid
      if (value === undefined && definition.required) return null

      if (value !== undefined) {
        if (definition.multiple) {
          if (!(value as NeRoArray<ParamValue>).every(definition.validate)) {
            return null
          }
        } else {
          if (!definition.validate(value as ParamValue)) {
            return null
          }
        }
      }

      result[key] = value ?? definition.default
    }

    return result as InferParams<S>
  }

  parseString(scope: string): InferParams<S> | null {
    const syntax = ScopeSyntax.fromString(scope)
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
