export type DateISO = `${string}T${string}Z`
export const toDateISO = (date: Date): DateISO => date.toISOString() as DateISO
export const fromDateISO = (date: DateISO): Date => new Date(date)

export type Json = string
export const toJson = (obj: unknown): Json => {
  const json = JSON.stringify(obj)
  if (json === undefined) throw new TypeError('Input not JSONifyable')
  return json as Json
}
export const fromJson = <T>(json: Json): T => {
  try {
    return JSON.parse(json) as T
  } catch (cause) {
    throw new TypeError('Database contains invalid JSON', { cause })
  }
}

export type JsonArray = `[${string}]`
export const isJsonArray = (json: string): json is JsonArray =>
  // Although the JSON in the DB should have been encoded using toJson,
  // there should not be any leading or trailing whitespace. We will still trim
  // the string to protect against any manual editing of the DB.
  json.trimStart().startsWith('[') && json.trimEnd().endsWith(']')
export function assertJsonArray(json: string): asserts json is JsonArray {
  if (!isJsonArray(json)) throw new TypeError('Not an Array')
}
export const toJsonArray = (obj: readonly unknown[]): JsonArray => {
  const json = toJson(obj)
  assertJsonArray(json)
  return json as JsonArray
}
export const fromJsonArray = <T>(json: JsonArray): T[] => {
  assertJsonArray(json)
  return fromJson(json) as T[]
}

export type JsonObject = `{${string}}`
const isJsonObject = (json: string): json is JsonObject =>
  // Although the JSON in the DB should have been encoded using toJson,
  // there should not be any leading or trailing whitespace. We will still trim
  // the string to protect against any manual editing of the DB.
  json.trimStart().startsWith('{') && json.trimEnd().endsWith('}')
function assertJsonObject(json: string): asserts json is JsonObject {
  if (!isJsonObject(json)) throw new TypeError('Not an Object')
}
export const toJsonObject = (
  obj: Readonly<Record<string, unknown>>,
): JsonObject => {
  const json = toJson(obj)
  assertJsonObject(json)
  return json as JsonObject
}
export const fromJsonObject = <T extends Record<string, unknown>>(
  json: JsonObject,
): T => {
  assertJsonObject(json)
  return fromJson(json) as T
}
