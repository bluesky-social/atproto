import { ParamValue } from './syntax.js'

// @NOTE Not types from from '@atproto/lex-document' because we want a readonly
// version here to prevent accidental mutation.

export type LexiconPermission<P extends string = string> = {
  readonly type: 'permission'
  readonly resource: P
  readonly [x: string]: undefined | ParamValue | readonly ParamValue[]
}

export type LexiconPermissionSet = {
  readonly type: 'permission-set'
  readonly permissions: readonly LexiconPermission<string>[]
}
