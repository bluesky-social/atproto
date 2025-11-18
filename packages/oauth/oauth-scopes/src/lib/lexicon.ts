import { ParamValue } from './syntax.js'

// @NOTE Not types from from '@atproto/lexicon' because we want a readonly
// version here to prevent accidental mutation.

export type LexPermission<P extends string = string> = {
  readonly type: 'permission'
  readonly resource: P
  readonly [x: string]: undefined | ParamValue | readonly ParamValue[]
}

export type LexPermissionSet = {
  readonly type: 'permission-set'
  readonly permissions: readonly LexPermission<string>[]
}
