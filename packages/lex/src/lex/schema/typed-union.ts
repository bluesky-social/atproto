import {
  Infer,
  UnknownString,
  ValidationContext,
  ValidationResult,
  Validator,
} from '../core.js'
import { isPureObject } from '../lib/is-object.js'
import { TypedRefSchema } from './typed-ref.js'

export type UnknownTypedObject = { $type: UnknownString }

type TypedRefSchemasToUnion<T extends readonly TypedRefSchema[]> = {
  [K in keyof T]: Infer<T[K]>
}[number]

export type TypedUnionSchemaOutput<
  TypedRefs extends readonly TypedRefSchema[],
  Closed extends boolean,
> = Closed extends true
  ? TypedRefSchemasToUnion<TypedRefs>
  : TypedRefSchemasToUnion<TypedRefs> | UnknownTypedObject

export class TypedUnionSchema<
  TypedRefs extends readonly TypedRefSchema[] = any,
  Closed extends boolean = any,
> extends Validator<TypedUnionSchemaOutput<TypedRefs, Closed>> {
  constructor(
    readonly refs: TypedRefs,
    readonly closed: Closed,
  ) {
    // @NOTE In order to avoid circular dependency issues, we don't access the
    // refs's schema (or $type) here. Instead, we access them lazily when first
    // needed.

    super()
  }

  protected get refsMap() {
    const map = new Map<unknown, TypedRefs[number]>()
    for (const ref of this.refs) map.set(ref.$type, ref)

    // Cache the map on the instance
    Object.defineProperty(this, 'refsMap', {
      value: map,
      writable: false,
      enumerable: false,
      configurable: true,
    })

    return map
  }

  get $types() {
    return Array.from(this.refsMap.keys())
  }

  protected override validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<TypedUnionSchemaOutput<TypedRefs, Closed>> {
    if (!isPureObject(input) || !('$type' in input)) {
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
