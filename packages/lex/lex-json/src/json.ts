export type JsonScalar = number | string | boolean | null
export type JsonValue = JsonScalar | JsonValue[] | { [_ in string]?: JsonValue }
export type JsonObject = { [_ in string]?: JsonValue }
