export type Simplify<T> = { [K in keyof T]: T[K] } & NonNullable<unknown>
export type TupleUnion<U extends string, R extends any[] = []> = {
  [S in U]: Exclude<U, S> extends never
    ? [...R, S]
    : TupleUnion<Exclude<U, S>, [...R, S]>
}[U]
