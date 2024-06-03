export type Simplify<T> = { [K in keyof T]: T[K] } & NonNullable<unknown>
