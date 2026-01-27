export type CheckFn<T> = <I extends string>(input: I) => input is I & T
