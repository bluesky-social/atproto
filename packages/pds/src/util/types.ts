export type Simplify<T> = {
  [K in keyof T]: T[K]
} & NonNullable<unknown>

export type WithRequired<T, K extends keyof T> = Simplify<
  Omit<T, K> & Required<Pick<T, K>>
>
