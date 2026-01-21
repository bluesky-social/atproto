import { isPlainObject } from '@atproto/lex-data'
import {
  InferInput,
  InferOutput,
  Schema,
  Unknown$TypedObject,
  ValidationContext,
} from '../core.js'
import { lazyProperty } from '../util/lazy-property.js'
import { TypedRefSchema } from './typed-ref.js'

export class TypedUnionSchema<
  const TValidators extends readonly TypedRefSchema[] = [],
  const TClosed extends boolean = boolean,
> extends Schema<
  TClosed extends true
    ? InferInput<TValidators[number]>
    : InferInput<TValidators[number]> | Unknown$TypedObject,
  TClosed extends true
    ? InferOutput<TValidators[number]>
    : InferOutput<TValidators[number]> | Unknown$TypedObject
> {
  constructor(
    protected readonly validators: TValidators,
    public readonly closed: TClosed,
  ) {
    // @NOTE In order to avoid circular dependency issues, we don't access the
    // refs's schema (or $type) here. Instead, we access them lazily when first
    // needed.

    super()
  }

  get validatorsMap(): Map<unknown, TValidators[number]> {
    const map = new Map<unknown, TValidators[number]>()
    for (const ref of this.validators) map.set(ref.$type, ref)

    return lazyProperty(this, 'validatorsMap', map)
  }

  get $types() {
    return Array.from(this.validatorsMap.keys())
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    if (!isPlainObject(input) || !('$type' in input)) {
      return ctx.issueInvalidType(input, '$typed')
    }

    const { $type } = input

    const validator = this.validatorsMap.get($type)
    if (validator) {
      return ctx.validate(input, validator)
    }

    if (this.closed) {
      return ctx.issueInvalidPropertyValue(input, '$type', this.$types)
    }

    if (typeof $type !== 'string') {
      return ctx.issueInvalidPropertyType(input, '$type', 'string')
    }

    return ctx.success(input)
  }
}

/*@__NO_SIDE_EFFECTS__*/
export function typedUnion<
  const R extends readonly TypedRefSchema[],
  const C extends boolean,
>(refs: R, closed: C) {
  return new TypedUnionSchema<R, C>(refs, closed)
}
