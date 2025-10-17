import {
  Infer,
  LexValidator,
  ValidationContext,
  ValidationResult,
} from '../core.js'
import { LexDict } from './dict.js'
import { LexObject, LexObjectOptions } from './object.js'

/**
 * Allows to more accurately represent the intersection of two object types
 * where both types may share some keys, and one of them uses an index
 * signature.
 *
 * @see {@link https://www.typescriptlang.org/play/?#code/C4TwDgpgBAglC8UDeUBmB7dAuKByARgIYBOuUAvlAGTJQDaA+lAJYB2UAzsMWwOYC6OVgFcAtvgjEKAKGkATCAGMANiWiL0rLlEI4YsjVuBQA1hBA4uPVrwRQARBnT2Dm7QDdCy4dESE6ZiD8UAD0IVAi4pJQABQcABbowspyUBIORMT2AJSyEAAeYOjExqCQUACSrMCSHErAzJoAPNJQsFAFNaxyHFAASkrFck1WfAA0UMKsJqzoAO6sAHxjrVAAQh35XT39g8TDozYTUzPzSyuLdqtwVKttMYHoqO00j88bnRDdvawQ7pJ3NpQAD860BbRwSHBQLadAA0ix2G91oJ1vDggAfWABcxPF5QOH8aFtci5aRlaAwVDMfIQVKIKo1Yh1RQNZq0Jw4AgkMjkCYoRiIzjcPioyISKTkRayBQqNRQQzaQgAMRpdL01NpclcRignm8EFVWrsKrVchxQVC4XF0SxmSAA Playground link}
 */
export type Intersect<
  A extends Record<string, unknown>,
  B extends Record<string, unknown>,
> = keyof A & keyof B extends never
  ? // If A and B don't overlap, just return A & B
    A & B
  : // Otherwise, properly represent the fact that accessing using an
    // index signature could return a value from either A or B
    A & { [K in keyof B]: B[K] | A[keyof A & K] }

// There is no point in using "intersect" with non-passthrough LexObjects so we
// enforce that here.
export type LexIntersectionObject = LexObject<
  any,
  LexObjectOptions & { unknownKeys?: 'passthrough' }
>

export type LexIntersectionOutput<
  KnownProps extends LexObject,
  ExtraProps extends LexDict,
> = Intersect<Infer<KnownProps>, Infer<ExtraProps>>

export class LexIntersection<
  KnownProps extends LexIntersectionObject = any,
  ExtraProps extends LexDict = any,
> extends LexValidator<LexIntersectionOutput<KnownProps, ExtraProps>> {
  constructor(
    readonly $knownProps: KnownProps,
    readonly $extraProps: ExtraProps,
  ) {
    super()
  }

  protected override $validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<LexIntersectionOutput<KnownProps, ExtraProps>> {
    const propsResult = ctx.validate(input, this.$knownProps)
    if (!propsResult.success) return propsResult

    const { value } = propsResult

    // The code bellow is similar to the one in LexDict, but we need to
    // validate only the keys that are not part of the known props.
    let copy: undefined | Record<string, unknown>

    for (const key in value) {
      if (this.$knownProps.$propertyKeys.has(key)) continue

      const keyResult = ctx.validate(key, this.$extraProps.$keySchema)
      if (!keyResult.success) return keyResult

      const valueResult = ctx.validateChild(
        value,
        key,
        this.$extraProps.$valueSchema,
      )
      if (!valueResult.success) return valueResult

      if (valueResult.value !== value[key]) {
        copy ??= { ...value }
        copy[key] = valueResult.value
      }
    }

    return ctx.success(
      (copy ?? value) as LexIntersectionOutput<KnownProps, ExtraProps>,
    )
  }
}
