import { isValidDid } from '@atproto/syntax'
import { Nsid, isNsid } from '../lib/nsid.js'
import { Parser } from '../lib/parser.js'
import { ResourcePermission } from '../lib/resource-permission.js'
import { ScopeStringSyntax } from '../lib/syntax-string.js'
import {
  NeArray,
  NeRoArray,
  ScopeSyntax,
  isScopeStringFor,
} from '../lib/syntax.js'
import { knownValuesValidator } from '../lib/util.js'

// Record-level actions. `read` is whole-space; `read_self` is the narrower
// own-repo-only grant. Defaulted (when `action` is omitted) to everything but
// `read_self`, since `read` already implies it.
export const SPACE_ACTIONS = Object.freeze([
  'read_self',
  'read',
  'create',
  'update',
  'delete',
] as const)
export type SpaceAction = (typeof SPACE_ACTIONS)[number]
export const isSpaceAction = knownValuesValidator(SPACE_ACTIONS)

export const SPACE_DEFAULT_ACTIONS = Object.freeze([
  'read',
  'create',
  'update',
  'delete',
] as const)

// Space-level management verbs, governed by the separate `manage=` param.
export const SPACE_MANAGE_OPS = Object.freeze([
  'create',
  'update',
  'delete',
] as const)
export type SpaceManageOp = (typeof SPACE_MANAGE_OPS)[number]
export const isSpaceManageOp = knownValuesValidator(SPACE_MANAGE_OPS)

/** Type param value: a space-type NSID, or "*" for any space type. */
export type SpaceTypeParam = '*' | Nsid
export const isSpaceTypeParam = (value: unknown): value is SpaceTypeParam =>
  value === '*' || isNsid(value)

/** Did param value: a DID (did:method:id) or "*" for any owner. */
type DidString = `did:${string}:${string}`
const isDidString = (value: unknown): value is DidString =>
  typeof value === 'string' && isValidDid(value)
export type SpaceDidParam = '*' | DidString
export const isSpaceDidParam = (value: unknown): value is SpaceDidParam =>
  value === '*' || isDidString(value)

/** Skey param value: any non-empty string up to 512 chars, or "*". */
export type SpaceSkeyParam = string
const SKEY_MAX_LENGTH = 512
export const isSpaceSkeyParam = (value: unknown): value is SpaceSkeyParam =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= SKEY_MAX_LENGTH

/** Collection param value: a NSID, or "*" for any collection. */
export type SpaceCollectionParam = '*' | Nsid
export const isSpaceCollectionParam = (
  value: unknown,
): value is SpaceCollectionParam => value === '*' || isNsid(value)

/**
 * The shape of a permission check at request time.
 *
 * - `read`: whole-space read. Collection-independent. Satisfied by a grant
 *   listing `read`.
 * - `read_self`: own-repo read. Collection-constrained. Satisfied by a grant
 *   listing `read` (which implies it) or `read_self`.
 * - `create | update | delete`: requires the action to be in the grant's
 *   action list AND the target collection to be in the grant's collection
 *   list. Empty collection list = no write targets.
 * - `manage` (a verb): governs space-level operations like `createSpace`,
 *   `addMember`, `removeMember`, `deleteSpace`. Collection-independent;
 *   requires the verb to be in the grant's `manage` list. Not implied by any
 *   record action.
 */
export type SpacePermissionMatch = {
  type: string
  did: string
  skey: string
} & (
  | { action: 'read'; collection?: never; manage?: never }
  | { action: 'read_self'; collection: string; manage?: never }
  | { action: 'create' | 'update' | 'delete'; collection: string; manage?: never }
  | { action?: never; collection?: never; manage: SpaceManageOp }
)

export class SpacePermission
  implements ResourcePermission<'space', SpacePermissionMatch>
{
  constructor(
    public readonly type: SpaceTypeParam,
    public readonly did: SpaceDidParam,
    public readonly skey: SpaceSkeyParam | '*',
    public readonly collection: NeRoArray<SpaceCollectionParam>,
    public readonly action: NeRoArray<SpaceAction>,
    public readonly manage: NeRoArray<SpaceManageOp>,
  ) {}

  matches(target: SpacePermissionMatch) {
    // Tuple match: (type, did, skey) must all overlap.
    if (this.type !== '*' && this.type !== target.type) return false
    if (this.did !== '*' && this.did !== target.did) return false
    if (this.skey !== '*' && this.skey !== target.skey) return false

    // Space management — governed by the separate `manage` list.
    if ('manage' in target && target.manage !== undefined) {
      return this.manage.includes(target.manage)
    }

    // Whole-space read. Collection-independent.
    if (target.action === 'read') {
      return this.action.includes('read')
    }

    // Own-repo read. `read` implies `read_self`; otherwise constrained by
    // collection like a write.
    if (target.action === 'read_self') {
      if (this.action.includes('read')) return true
      if (!this.action.includes('read_self')) return false
      return this.collectionAllows(target.collection)
    }

    // Write check: action must be in the grant's action list and the target
    // collection must be in the grant's collection list.
    if (!this.action.includes(target.action)) return false
    return this.collectionAllows(target.collection)
  }

  private collectionAllows(collection: string): boolean {
    return (
      this.collection.includes('*') ||
      (this.collection as readonly string[]).includes(collection)
    )
  }

  toString() {
    return SpacePermission.parser.format(this)
  }

  protected static readonly parser = new Parser(
    'space',
    {
      type: {
        multiple: false,
        required: true,
        validate: isSpaceTypeParam,
      },
      did: {
        multiple: false,
        required: false,
        default: '*' as const,
        validate: isSpaceDidParam,
      },
      skey: {
        multiple: false,
        required: false,
        default: '*' as const,
        validate: (value): value is SpaceSkeyParam | '*' =>
          value === '*' || isSpaceSkeyParam(value),
      },
      collection: {
        multiple: true,
        required: false,
        validate: isSpaceCollectionParam,
        // No default — omitted means "no write targets" (the matcher returns
        // false on writes when the grant has no collections). The parser
        // represents this as an empty list internally.
        default: [] as unknown as NeRoArray<SpaceCollectionParam>,
        normalize: (value) => {
          if (value.length > 1) {
            if (value.includes('*')) return ['*'] as const
            return [...new Set(value)].sort() as NeArray<Nsid>
          }
          return value as ['*' | Nsid]
        },
      },
      action: {
        multiple: true,
        required: false,
        validate: isSpaceAction,
        // Omitting `action` grants read + the three writes (read implies
        // read_self), per proposal 0016.
        default: SPACE_DEFAULT_ACTIONS as unknown as NeRoArray<SpaceAction>,
        normalize: (value) => {
          return SPACE_ACTIONS.filter(includedIn, value) as NeArray<SpaceAction>
        },
      },
      manage: {
        multiple: true,
        required: false,
        validate: isSpaceManageOp,
        // Omitted by default — an ordinary record grant confers no admin.
        default: [] as unknown as NeRoArray<SpaceManageOp>,
        normalize: (value) => {
          return SPACE_MANAGE_OPS.filter(
            includedIn,
            value,
          ) as NeArray<SpaceManageOp>
        },
      },
    },
    'type',
  )

  static fromString(scope: string): SpacePermission | null {
    if (!isScopeStringFor(scope, 'space')) return null
    const syntax = ScopeStringSyntax.fromString(scope)
    return SpacePermission.fromSyntax(syntax)
  }

  static fromSyntax(syntax: ScopeSyntax<'space'>): SpacePermission | null {
    const result = SpacePermission.parser.parse(syntax)
    if (!result) return null

    return new SpacePermission(
      result.type,
      result.did,
      result.skey,
      result.collection,
      result.action,
      result.manage,
    )
  }

  static scopeNeededFor(options: SpacePermissionMatch): string {
    const base = {
      type: options.type as SpaceTypeParam,
      did: options.did as SpaceDidParam,
      skey: options.skey as SpaceSkeyParam | '*',
    }
    // Space management grant.
    if ('manage' in options && options.manage !== undefined) {
      return SpacePermission.parser.format({
        ...base,
        collection: [] as unknown as NeRoArray<SpaceCollectionParam>,
        action: [] as unknown as NeRoArray<SpaceAction>,
        manage: [options.manage],
      })
    }
    // Record grant. `read` is collection-independent; the rest carry a target
    // collection.
    const collection = (
      options.action === 'read'
        ? []
        : [options.collection as SpaceCollectionParam]
    ) as unknown as NeRoArray<SpaceCollectionParam>
    return SpacePermission.parser.format({
      ...base,
      collection,
      action: [options.action],
      manage: [] as unknown as NeRoArray<SpaceManageOp>,
    })
  }
}

function includedIn<T>(this: readonly T[], value: T): boolean {
  return this.includes(value)
}
