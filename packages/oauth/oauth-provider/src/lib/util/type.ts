export type Simplify<T> = { [K in keyof T]: T[K] } & {}
export type Override<T, V> = Simplify<V & Omit<T, keyof V>>
export type Awaitable<T> = T | Promise<T>
