/**
 * Primitive JSON values: string, number, boolean, or null.
 *
 * These are the scalar (non-composite) types that can appear in JSON data.
 * In the context of the AT Protocol:
 * - `string` - Text values, including special encoded types like `$link` and `$bytes`
 * - `number` - Numeric values (note: Lex only supports safe integers)
 * - `boolean` - True/false values
 * - `null` - Explicit null values
 *
 * @see {@link JsonValue} for the complete JSON type including arrays and objects
 */
export type JsonScalar = number | string | boolean | null

/**
 * Any valid JSON value.
 *
 * This is a recursive type that represents the full JSON data model:
 * - Scalars: string, number, boolean, null
 * - Arrays: ordered lists of JSON values
 * - Objects: string-keyed maps of JSON values
 *
 * @example
 * ```typescript
 * const scalar: JsonValue = "hello"
 * const array: JsonValue = [1, 2, 3]
 * const object: JsonValue = { name: "Alice", age: 30 }
 * const nested: JsonValue = { users: [{ name: "Bob" }] }
 * ```
 */
export type JsonValue = JsonScalar | JsonValue[] | { [_ in string]?: JsonValue }

/**
 * A JSON object with string keys and JSON values.
 *
 * This type represents a plain JavaScript object that is valid JSON,
 * where all keys are strings and all values are valid JSON values.
 *
 * @example
 * ```typescript
 * const obj: JsonObject = {
 *   name: "Alice",
 *   tags: ["admin", "user"],
 *   metadata: { created: "2024-01-01" }
 * }
 * ```
 */
export type JsonObject = { [_ in string]?: JsonValue }
