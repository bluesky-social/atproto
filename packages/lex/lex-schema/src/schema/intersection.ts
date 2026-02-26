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
 * Type utility for computing the intersection of two object types.
 *
 * Allows to more accurately represent the intersection of two object types
 * where both types may share some keys, and one of them uses an index
 * signature.
 *
 * @template A - First object type (typically from ObjectSchema)
 * @template B - Second object type (typically from DictSchema)
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

/**
 * Schema for combining an object schema with a dictionary schema.
 *
 * Validates that the input matches both the fixed object shape and allows
 * additional properties that match the dictionary schema. Properties defined
 * in the object schema are validated by the object, and remaining properties
 * are validated by the dictionary.
 *
 * @template Left - The ObjectSchema type for fixed properties
 * @template Right - The DictSchema type for additional properties
 *
 * @example
 * ```ts
 * const schema = new IntersectionSchema(
 *   l.object({ name: l.string() }),
 *   l.dict(l.string(), l.integer())
 * )
 * // Validates: { name: 'test', score: 100, count: 5 }
 * ```
 */
export class IntersectionSchema<
  const Left extends ObjectSchema = any,
  const Right extends DictSchema = any,
> extends Schema<
  Simplify<Intersect<InferInput<Left>, InferInput<Right>>>,
  Simplify<Intersect<InferOutput<Left>, InferOutput<Right>>>
> {
  readonly type = 'intersection' as const

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

/**
 * Creates an intersection schema combining fixed object properties with dynamic dictionary properties.
 *
 * Useful for objects that have a known set of properties plus additional
 * arbitrary properties that follow a pattern.
 *
 * @param left - Object schema defining the fixed, known properties
 * @param right - Dictionary schema for validating additional properties
 * @returns A new {@link IntersectionSchema} instance
 *
 * @example
 * ```ts
 * // Object with fixed and dynamic properties
 * const configSchema = l.intersection(
 *   l.object({
 *     version: l.integer(),
 *     name: l.string(),
 *   }),
 *   l.dict(l.string(), l.string()) // Additional string properties
 * )
 *
 * configSchema.parse({
 *   version: 1,
 *   name: 'my-config',
 *   customField: 'value',
 *   anotherField: 'another',
 * })
 * ```
 */
/*@__NO_SIDE_EFFECTS__*/
export function intersection<
  const Left extends ObjectSchema,
  const Right extends DictSchema,
>(left: Left, right: Right) {
  return new IntersectionSchema<Left, Right>(left, right)
}
