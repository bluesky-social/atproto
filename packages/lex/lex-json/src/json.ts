export type JsonScalar = number | string | boolean | null
export type Json = JsonScalar | Json[] | { [_ in string]?: Json }
export type JsonObject = { [_ in string]?: Json }
