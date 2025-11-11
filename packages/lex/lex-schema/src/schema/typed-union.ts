import { isPlainObject } from '@atproto/lex-data'
import { Restricted, UnknownString } from '../core.js'
import {
  Infer,
  ValidationContext,
  ValidationResult,
  Validator,
} from '../validation.js'
import { TypedRefSchema, TypedRefSchemaOutput } from './typed-ref.js'

export type TypedRef<T extends { $type?: string }> = TypedRefSchemaOutput<T>

export type UnknownProperty = Restricted<'Unknown property'>
export type UnknownTypedObject = { $type: UnknownString } & {
  // In order to prevent places that expect an open union from accepting an
  // invalid version of the known typed objects, we need to prevent any other
  // properties from being present.
  //
  // For example, if an open union expects:
  // ```ts
  // UnknownTypedObject | { $type: 'A'; a: number }
  // ```
  // we don't want it to accept:
  // ```ts
  // { $type: 'A' }
  // ```
  // Which would be the case as `{ $type: 'A' }` is a valid
  // `UnknownTypedObject`. By adding an index signature that forbids any
  // property, we ensure that only valid known typed objects can be used.
  [K in string]: UnknownProperty
}

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
  readonly lexiconType = 'union' as const

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

  override validateInContext(
    input: unknown,
    ctx: ValidationContext,
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
