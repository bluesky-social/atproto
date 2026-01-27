import {
  InferInput,
  InferOutput,
  Schema,
  ValidationContext,
  Validator,
  WrappedValidator,
} from '../core.js'

export type RefSchemaGetter<out TValidator extends Validator> = () => TValidator

export class RefSchema<const TValidator extends Validator>
  extends Schema<
    InferInput<TValidator>,
    InferOutput<TValidator>,
    TValidator['__lex']
  >
  implements WrappedValidator<TValidator>
{
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
