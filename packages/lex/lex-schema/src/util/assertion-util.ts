export type AssertFn<T> = <I extends string>(input: I) => asserts input is I & T
export type CastFn<T> = <I extends string>(input: I) => I & T
export type CheckFn<T> = <I extends string>(input: I) => input is I & T

export function createAssertFunction<T extends string>(
  checkFn: (input: string) => input is T,
  errorMessage?: string,
): AssertFn<T>
export function createAssertFunction<T extends string>(
  checkFn: (input: string) => boolean,
  errorMessage?: string,
): AssertFn<T>
export function createAssertFunction<T extends string>(
  checkFn: (input: string) => boolean,
  errorMessage = 'Invalid format',
): AssertFn<T> {
  return (input: string) => {
    if (!checkFn(input)) throw new Error(errorMessage)
  }
}

/*@__NO_SIDE_EFFECTS__*/
export function createCastFunction<T>(assertFn: AssertFn<T>): CastFn<T> {
  return <I extends string>(input: I) => {
    assertFn(input)
    return input as I & T
  }
}

/*@__NO_SIDE_EFFECTS__ */
export function createCheckFunction<T>(assertFn: AssertFn<T>): CheckFn<T> {
  return <I extends string>(input: I): input is I & T => {
    try {
      assertFn(input)
      return true
    } catch {
      return false
    }
  }
}
