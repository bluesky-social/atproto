export type CheckFn<T> = <I>(input: I) => input is I & T

export function buildCaster<T>(
  checker: CheckFn<T>,
  message: string,
): (input: unknown) => T {
  return function caster(input) {
    if (!checker(input)) throw new Error(message)
    return input
  }
}
