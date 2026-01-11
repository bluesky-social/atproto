import { isPlainObject } from '@atproto/lex-data'
import {
  Infer,
  Schema,
  Unknown$TypedObject,
  ValidationResult,
  ValidatorContext,
} from '../core.js'
import { lazyProperty } from '../util/lazy-property.js'
import { TypedRefSchema, TypedRefSchemaOutput } from './typed-ref.js'

export type TypedRef<T extends { $type?: string }> = TypedRefSchemaOutput<T>

type TypedRefSchemasToUnion<T extends readonly TypedRefSchema[]> = {
  [K in keyof T]: Infer<T[K]>
}[number]

export type TypedUnionSchemaOutput<
  TypedRefs extends readonly TypedRefSchema[],
  Closed extends boolean,
> = Closed extends true
  ? TypedRefSchemasToUnion<TypedRefs>
  : TypedRefSchemasToUnion<TypedRefs> | Unknown$TypedObject

export class TypedUnionSchema<
  TypedRefs extends readonly TypedRefSchema[] = any,
  Closed extends boolean = any,
> extends Schema<TypedUnionSchemaOutput<TypedRefs, Closed>> {
  constructor(
    protected readonly refs: TypedRefs,
    public readonly closed: Closed,
  ) {
    // @NOTE In order to avoid circular dependency issues, we don't access the
    // refs's schema (or $type) here. Instead, we access them lazily when first
    // needed.

    super()
  }

  get refsMap(): Map<unknown, TypedRefs[number]> {
    const map = new Map<unknown, TypedRefs[number]>()
    for (const ref of this.refs) map.set(ref.$type, ref)

    return lazyProperty(this, 'refsMap', map)
  }

  get $types() {
    return Array.from(this.refsMap.keys())
  }

  validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<TypedUnionSchemaOutput<TypedRefs, Closed>> {
    if (!isPlainObject(input) || !('$type' in input)) {
      return ctx.issueInvalidType(input, '$typed')
    }

    const { $type } = input

    const def = this.refsMap.get($type)
    if (def) {
      const result = ctx.validate(input, def)
      return result as ValidationResult<
        TypedUnionSchemaOutput<TypedRefs, Closed>
      >
    }

    if (this.closed) {
      return ctx.issueInvalidPropertyValue(input, '$type', this.$types)
    }
    if (typeof $type !== 'string') {
      return ctx.issueInvalidPropertyType(input, '$type', 'string')
    }

    return ctx.success(input as TypedUnionSchemaOutput<TypedRefs, Closed>)
  }
}
