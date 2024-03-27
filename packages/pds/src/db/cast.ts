export type DateISO = `${string}T${string}Z`
export const toDateISO = (date: Date): DateISO => date.toISOString() as DateISO
export const fromDateISO = (date: DateISO): Date => new Date(date)

export type Json = string
export const toJson = (obj: unknown): Json => {
  const json = JSON.stringify(obj)
  if (typeof json !== 'string') {
    throw new TypeError('Invalid JSON')
  }
  return json as Json
}
export const fromJson = <T>(json: Json): T => {
  return JSON.parse(json) as T
}

export type JsonArray = `[${string}]`
export const toJsonArray = (obj: readonly unknown[]): JsonArray => {
  const json = toJson(obj)
  if (!json.startsWith('[') || !json.endsWith(']')) {
    throw new TypeError('Not a JSON Array')
  }
  return json as JsonArray
}
export const fromJsonArray = <T extends unknown[]>(json: JsonArray): T => {
  return fromJson(json) as T
}

export type JsonObject = `{${string}}`
export const toJsonObject = (
  obj: Readonly<Record<string, unknown>>,
): JsonObject => {
  const json = toJson(obj)
  if (!json.startsWith('{') || !json.endsWith('}')) {
    throw new TypeError('Not a JSON Object')
  }
  return json as JsonObject
}
export const fromJsonObject = <T extends Record<string, unknown>>(
  json: JsonObject,
): T => {
  return fromJson(json) as T
}
