import { ZodError } from 'zod'

export interface Def<T> {
  name: string
  schema: {
    parse: (obj: unknown) => T
    safeParse: (
      obj: unknown,
    ) => { success: true; data: T } | { success: false; error: ZodError }
  }
}

export const is = <T>(obj: unknown, def: Def<T>): obj is T => {
  return def.schema.safeParse(obj).success
}

export const assure = <T>(def: Def<T>, obj: unknown): T => {
  return def.schema.parse(obj)
}

export const isObject = (obj: unknown): obj is Record<string, unknown> => {
  return typeof obj === 'object' && obj !== null
}
