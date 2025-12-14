export type AssertFn<T> = <I extends string>(input: I) => asserts input is I & T
export type CastFn<T> = <I extends string>(input: I) => I & T
export type CheckFn<T> = <I extends string>(input: I) => input is I & T

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
