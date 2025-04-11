export type DateISO = `${string}T${string}Z`
export function toDateISO(date: Date) {
  return date.toISOString() as DateISO
}
export function fromDateISO(dateStr: DateISO) {
  return new Date(dateStr)
}

/**
 * Allows to ensure that {@link JsonEncoded} is not used with non-JSON
 * serializable values (e.g. {@link Date} or {@link Function}s).
 */
export type Encodable =
  | string
  | number
  | boolean
  | null
  | readonly Encodable[]
  | { readonly [_ in string]?: Encodable }

export type JsonString<T extends Encodable> = T extends readonly unknown[]
  ? `[${string}]`
  : T extends object
    ? `{${string}}`
    : T extends string
      ? `"${string}"`
      : T extends number
        ? `${number}`
        : T extends boolean
          ? `true` | `false`
          : T extends null
            ? `null`
            : never

declare const jsonEncodedType: unique symbol
export type JsonEncoded<T extends Encodable = Encodable> = JsonString<T> & {
  [jsonEncodedType]: T
}

export function toJson<T extends Encodable>(value: T): JsonEncoded<T> {
  const json = JSON.stringify(value)
  if (json === undefined) throw new TypeError('Input not JSONifyable')
  return json as JsonEncoded<T>
}

export function fromJson<T extends Encodable>(jsonStr: JsonEncoded<T>): T {
  try {
    return JSON.parse(jsonStr) as T
  } catch (cause) {
    throw new TypeError('Database contains invalid JSON', { cause })
  }
}
