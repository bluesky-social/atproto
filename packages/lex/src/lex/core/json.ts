export type JsonScalar = number | string | boolean | null
export type Json = JsonScalar | Json[] | { [key: string]: Json }
export type JsonObject = { [key: string]: Json }
