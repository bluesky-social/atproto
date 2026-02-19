import {
  InferInput,
  InferOutput,
  Schema,
  ValidationContext,
  Validator,
  WrappedValidator,
} from '../core.js'

/**
 * Function type that returns a validator, used for lazy schema resolution.
 *
 * @template TValidator - The validator type that will be returned
 */
export type RefSchemaGetter<out TValidator extends Validator> = () => TValidator

/**
 * Schema for creating references to other schemas with lazy resolution.
 *
 * Useful for handling circular references or breaking module dependency cycles.
 * The referenced schema is resolved lazily when first needed for validation.
 *
 * @template TValidator - The referenced validator type
 *
 * @example
 * ```ts
 * // Self-referential schema for tree structure
 * const nodeSchema = l.object({
 *   value: l.string(),
 *   children: l.array(l.ref(() => nodeSchema)),
 * })
 * ```
 */
export class RefSchema<const TValidator extends Validator>
  extends Schema<
    InferInput<TValidator>,
    InferOutput<TValidator>,
    TValidator['__lex']
  >
  implements WrappedValidator<TValidator>
{
  readonly type = 'ref' as const

  #getter: RefSchemaGetter<TValidator>

  constructor(getter: RefSchemaGetter<TValidator>) {
    // @NOTE In order to avoid circular dependency issues, we don't resolve
    // the schema here. Instead, we resolve it lazily when first accessed.

    super()

    this.#getter = getter
  }

  get validator(): TValidator {
    return this.#getter.call(null)
  }

  unwrap(): TValidator {
    return this.validator
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    return ctx.validate(input, this.validator)
  }
}

/**
 * Creates a reference schema with lazy resolution.
 *
 * Allows referencing schemas that may not be defined yet, enabling
 * circular references and breaking dependency cycles. The getter function
 * is called lazily when validation is first performed.
 *
 * @param get - Function that returns the referenced validator
 * @returns A new {@link RefSchema} instance
 *
 * @example
 * ```ts
 * // Circular reference - tree node that contains children of the same type
 * const treeNodeSchema = l.object({
 *   name: l.string(),
 *   children: l.optional(l.array(l.ref(() => treeNodeSchema))),
 * })
 *
 * // Cross-module reference
 * const commentSchema = l.object({
 *   text: l.string(),
 *   author: l.ref(() => userSchema), // userSchema defined elsewhere
 * })
 *
 * // Explicitly typed reference
 * const itemSchema = l.ref<Item>(() => complexItemSchema)
 * ```
 */
/*@__NO_SIDE_EFFECTS__*/
export function ref<const TValidator extends Validator>(
  get: RefSchemaGetter<TValidator>,
): RefSchema<TValidator>
export function ref<TInput, TOutput extends TInput = TInput>(
  get: RefSchemaGetter<Validator<TInput, TOutput>>,
): RefSchema<Validator<TInput, TOutput>>
export function ref<const TValidator extends Validator>(
  get: RefSchemaGetter<TValidator>,
) {
  return new RefSchema<TValidator>(get)
}
