export interface Def<T> {
  parse: (obj: unknown) => T
  safeParse: (obj: unknown) => { success: boolean }
}

export const is = <T>(obj: unknown, def: Def<T>): obj is T => {
  return def.safeParse(obj).success
}

export const assure = <T>(def: Def<T>, obj: unknown): T => {
  return def.parse(obj)
}

export const isObject = (obj: unknown): obj is Record<string, unknown> => {
  return typeof obj === 'object' && obj !== null
}
