import {
  InferInput,
  InferOutput,
  Schema,
  Simplify,
  ValidationContext,
} from '../core.js'
import { DictSchema } from './dict.js'
import { ObjectSchema } from './object.js'

/**
 * Allows to more accurately represent the intersection of two object types
 * where both types may share some keys, and one of them uses an index
 * signature.
 *
 * @see {@link https://www.typescriptlang.org/play/?#code/C4TwDgpgBAglC8UDeUBmB7dAuKByARgIYBOuUAvlAGTJQDaA+lAJYB2UAzsMWwOYC6OVgFcAtvgjEKAKGkATCAGMANiWiL0rLlEI4YsjVuBQA1hBA4uPVrwRQARBnT2Dm7QDdCy4dESE6ZiD8UAD0IVAi4pJQABQcABbowspyUBIORMT2AJSyEAAeYOjExqCQUACSrMCSHErAzJoAPNJQsFAFNaxyHFAASkrFck1WfAA0UMKsJqzoAO6sAHxjrVAAQh35XT39g8TDozYTUzPzSyuLdqtwVKttMYHoqO00j88bnRDdvawQ7pJ3NpQAD860BbRwSHBQLadAA0ix2G91oJ1vDggAfWABcxPF5QOH8aFtci5aRlaAwVDMfIQVKIKo1Yh1RQNZq0Jw4AgkMjkCYoRiIzjcPioyISKTkRayBQqNRQQzaQgAMRpdL01NpclcRignm8EFVWrsKrVchxQVC4XF0SxmSAA Playground link}
 */
export type Intersect<A, B> = B[keyof B] extends never
  ? A
  : keyof A & keyof B extends never
    ? // If A and B don't overlap, just return A & B
      A & B
    : // Otherwise, properly represent the fact that accessing using an
      // index signature could return a value from either A or B
      A & { [K in keyof B]: B[K] | A[keyof A & K] }

export class IntersectionSchema<
  const Left extends ObjectSchema = any,
  const Right extends DictSchema = any,
> extends Schema<
  Simplify<Intersect<InferInput<Left>, InferInput<Right>>>,
  Simplify<Intersect<InferOutput<Left>, InferOutput<Right>>>
> {
  constructor(
    protected readonly left: Left,
    protected readonly right: Right,
  ) {
    super()
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    const leftResult = ctx.validate(input, this.left)
    if (!leftResult.success) return leftResult

    return this.right.validateInContext(leftResult.value, ctx, {
      ignoredKeys: this.left.validatorsMap,
    })
  }
}

/*@__NO_SIDE_EFFECTS__*/
export function intersection<
  const Left extends ObjectSchema,
  const Right extends DictSchema,
>(left: Left, right: Right) {
  return new IntersectionSchema<Left, Right>(left, right)
}
