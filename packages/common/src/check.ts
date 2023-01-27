import { ZodError } from 'zod'

export interface Checkable<T> {
  parse: (obj: unknown) => T
  safeParse: (
    obj: unknown,
  ) => { success: true; data: T } | { success: false; error: ZodError }
}

export interface Def<T> {
  name: string
  schema: Checkable<T>
}

export const is = <T>(obj: unknown, def: Checkable<T>): obj is T => {
  return def.safeParse(obj).success
}

export const assure = <T>(def: Checkable<T>, obj: unknown): T => {
  return def.parse(obj)
}

export const isObject = (obj: unknown): obj is Record<string, unknown> => {
  return typeof obj === 'object' && obj !== null
}
