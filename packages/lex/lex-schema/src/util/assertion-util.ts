export type CheckFn<T> = <I>(input: I) => input is I & T
