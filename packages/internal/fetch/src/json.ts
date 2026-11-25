export type JsonScalar = string | number | boolean | null
export type Json = JsonScalar | Json[] | { [key: string]: undefined | Json }
export type JsonObject = { [key: string]: undefined | Json }
export type JsonArray = Json[]
