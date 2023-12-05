import { DynamicReferenceBuilder } from 'kysely/dist/cjs/dynamic/dynamic-reference-builder'

export type Ref = DynamicReferenceBuilder<any>

export type OptionalJoin<T> = { [key in keyof T]: T[key] | null }
