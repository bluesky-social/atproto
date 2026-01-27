import {
  $Typed,
  InferInput,
  InferOutput,
  Schema,
  ValidationContext,
  Validator,
} from '../core.js'

export interface TypedObjectValidator<
  TInput extends { $type?: string } = { $type?: string },
  TOutput extends TInput = TInput,
> extends Validator<TInput, TOutput> {
  $type: NonNullable<TOutput['$type']>
}

export type TypedRefGetter<out TValidator extends TypedObjectValidator> =
  () => TValidator

export class TypedRefSchema<
  const TValidator extends TypedObjectValidator = TypedObjectValidator,
> extends Schema<
  $Typed<InferInput<TValidator>>,
  $Typed<InferOutput<TValidator>>
> {
  #getter: TypedRefGetter<TValidator>

  constructor(getter: TypedRefGetter<TValidator>) {
    // @NOTE In order to avoid circular dependency issues, we don't resolve
    // the schema here. Instead, we resolve it lazily when first accessed.

    super()

    this.#getter = getter
  }

  get validator(): TValidator {
    return this.#getter.call(null)
  }

  get $type(): TValidator['$type'] {
    return this.validator.$type
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    const result = ctx.validate(input, this.validator)
    if (!result.success) return result

    if (result.value.$type !== this.$type) {
      return ctx.issueInvalidPropertyValue(result.value, '$type', [this.$type])
    }

    return result
  }
}

/*@__NO_SIDE_EFFECTS__*/
export function typedRef<const TValidator extends TypedObjectValidator>(
  get: TypedRefGetter<TValidator>,
): TypedRefSchema<TValidator>
export function typedRef<
  TInput extends { $type?: string },
  TOutput extends TInput = TInput,
>(
  get: TypedRefGetter<TypedObjectValidator<TInput, TOutput>>,
): TypedRefSchema<TypedObjectValidator<TInput, TOutput>>
export function typedRef<const TValidator extends TypedObjectValidator>(
  get: TypedRefGetter<TValidator>,
): TypedRefSchema<TValidator> {
  return new TypedRefSchema<TValidator>(get)
}
