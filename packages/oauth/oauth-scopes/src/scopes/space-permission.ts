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

export const SPACE_ACTIONS = Object.freeze([
  'read',
  'create',
  'update',
  'delete',
] as const)
export type SpaceAction = (typeof SPACE_ACTIONS)[number]
export const isSpaceAction = knownValuesValidator(SPACE_ACTIONS)

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
 * The shape of a permission check at request time. Reads pass `action: 'read'`
 * and need only (type, did, skey) to overlap with the grant; writes also need
 * `collection` and a write `action` that intersect with the grant.
 *
 * Read access is implicit — any matching grant confers read regardless of its
 * declared `action` list, except when the grant lists `action=read` alone.
 * Use `assertSpaceWrite`/`allowsSpaceWrite` (downstream) for write checks.
 */
export type SpacePermissionMatch = {
  type: string
  did: string
  skey: string
} & (
  | { action: 'read'; collection?: never }
  | { action: 'create' | 'update' | 'delete'; collection: string }
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
  ) {}

  matches(target: SpacePermissionMatch) {
    // Tuple match: (type, did, skey) must all overlap.
    if (this.type !== '*' && this.type !== target.type) return false
    if (this.did !== '*' && this.did !== target.did) return false
    if (this.skey !== '*' && this.skey !== target.skey) return false

    // Read is the baseline — any grant on the right (type, did, skey) tuple
    // confers read access, regardless of its `collection` list. The only way
    // a grant can refuse read is by explicitly listing `action=read` only,
    // since the action list still has to include `read`.
    if (target.action === 'read') {
      return this.action.includes('read')
    }

    // Write check: action must be in the grant's action list and the target
    // collection must be in the grant's collection list.
    if (!this.action.includes(target.action)) return false
    return (
      this.collection.includes('*') ||
      (this.collection as readonly string[]).includes(target.collection)
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
        default: SPACE_ACTIONS,
        normalize: (value) => {
          return value === SPACE_ACTIONS
            ? SPACE_ACTIONS
            : (SPACE_ACTIONS.filter(includedIn, value) as NeArray<SpaceAction>)
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
    )
  }

  static scopeNeededFor(options: SpacePermissionMatch): string {
    return SpacePermission.parser.format({
      type: options.type as SpaceTypeParam,
      did: options.did as SpaceDidParam,
      skey: options.skey as SpaceSkeyParam | '*',
      collection:
        options.action === 'read'
          ? ([] as unknown as NeRoArray<SpaceCollectionParam>)
          : [options.collection as SpaceCollectionParam],
      action: [options.action],
    })
  }
}

function includedIn<T>(this: readonly T[], value: T): boolean {
  return this.includes(value)
}
