import { isPlainObject } from '@atproto/lex-data'
import {
  Infer,
  Restricted,
  Schema,
  ValidationResult,
  ValidatorContext,
} from '../core.js'
import { lazyProperty } from '../util/lazy-property.js'
import { TypedRefSchema, TypedRefSchemaOutput } from './typed-ref.js'

export type TypedRef<T extends { $type?: string }> = TypedRefSchemaOutput<T>

export type TypedObject = { $type: string } & {
  // In order to prevent places that expect an open union from accepting an
  // invalid version of the known typed objects, we need to prevent any other
  // properties from being present.
  //
  // For example, if an open union expects:
  // ```ts
  // TypedObject | { $type: 'A'; a: number }
  // ```
  // we don't want it to accept:
  // ```ts
  // { $type: 'A' }
  // ```
  // Which would be the case as `{ $type: 'A' }` is a valid
  // `TypedObject`. By adding an index signature that forbids any
  // property, we ensure that only valid known typed objects can be used.
  [K in string]: Restricted<'Unknown property'>
}

type TypedRefSchemasToUnion<T extends readonly TypedRefSchema[]> = {
  [K in keyof T]: Infer<T[K]>
}[number]

export type TypedUnionSchemaOutput<
  TypedRefs extends readonly TypedRefSchema[],
  Closed extends boolean,
> = Closed extends true
  ? TypedRefSchemasToUnion<TypedRefs>
  : TypedRefSchemasToUnion<TypedRefs> | TypedObject

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
