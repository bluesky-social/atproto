import {
  Infer,
  LexValidator,
  UnknownString,
  ValidationContext,
  ValidationResult,
  isPureObject,
} from '../core.js'
import { cachedGetter } from '../lib/decorators.js'
import { LexTypedRef } from './typed-ref.js'

export type UnknownTypedObject = { $type: UnknownString }

type LexTypedRefsToUnion<T extends readonly LexTypedRef[]> = {
  [K in keyof T]: Infer<T[K]>
}[number]

export type LexTypedUnionOutput<
  TypedRefs extends readonly LexTypedRef[],
  Closed extends boolean,
> = Closed extends true
  ? LexTypedRefsToUnion<TypedRefs>
  : LexTypedRefsToUnion<TypedRefs> | UnknownTypedObject

export class LexTypedUnion<
  TypedRefs extends readonly LexTypedRef[] = any,
  Closed extends boolean = any,
> extends LexValidator<LexTypedUnionOutput<TypedRefs, Closed>> {
  constructor(
    readonly $refs: TypedRefs,
    readonly $closed: Closed,
  ) {
    super()
  }

  // Computed lazily to avoid resolving circular deps during init (would be undefined)
  @cachedGetter
  protected get $refsMap() {
    const map = new Map<unknown, TypedRefs[number]>()
    for (const ref of this.$refs) map.set(ref.$type, ref)
    return map
  }

  @cachedGetter
  get $types() {
    return Array.from(this.$refsMap.keys())
  }

  protected override $validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<LexTypedUnionOutput<TypedRefs, Closed>> {
    if (!isPureObject(input)) {
      return ctx.issueInvalidType(input, 'object')
    }

    const { $type } = input

    const def = this.$refsMap.get($type)
    if (def) {
      const result = ctx.validate(input, def)
      return result as ValidationResult<LexTypedUnionOutput<TypedRefs, Closed>>
    }

    if (this.$closed) {
      return ctx.issueInvalidPropertyValue(input, '$type', this.$types)
    }
    if (typeof $type !== 'string') {
      return ctx.issueInvalidPropertyType(input, '$type', 'string')
    }

    return ctx.success(input as LexTypedUnionOutput<TypedRefs, Closed>)
  }
}
