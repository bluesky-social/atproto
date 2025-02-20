// eslint-disable-next-line @typescript-eslint/ban-types
export type Simplify<T> = { [K in keyof T]: T[K] } & {}
export type Override<T, V> = Simplify<{
  [K in keyof (V & T)]: K extends keyof V
    ? V[K]
    : K extends keyof T
      ? T[K]
      : never
}>
export type Awaitable<T> = T | Promise<T>
