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
  'manage',
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
 * The shape of a permission check at request time.
 *
 * - `read`: any grant on the matching (type, did, skey) tuple whose action
 *   list includes `read` (the default). Collection-independent.
 * - `create | update | delete`: requires the action to be in the grant's
 *   action list AND the target collection to be in the grant's collection
 *   list. Empty collection list = no write targets.
 * - `manage`: governs space-level operations like `createSpace`,
 *   `addMember`, `removeMember`, `deleteSpace`. Collection-independent;
 *   requires the action list to include `manage`. Implicitly grants read.
 */
export type SpacePermissionMatch = {
  type: string
  did: string
  skey: string
} & (
  | { action: 'read' | 'manage'; collection?: never }
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
    // confers read access if it lists `read`. `manage` also implies read,
    // since space-level admin without read access doesn't make sense.
    if (target.action === 'read') {
      return this.action.includes('read') || this.action.includes('manage')
    }

    // Manage is collection-independent — governs space-level operations
    // (createSpace, addMember, removeMember, deleteSpace).
    if (target.action === 'manage') {
      return this.action.includes('manage')
    }

    // Write check: action must be in the grant's action list and the target
    // collection must be in the grant's collection list.
    const writeTarget = target as Extract<
      SpacePermissionMatch,
      { action: 'create' | 'update' | 'delete' }
    >
    if (!this.action.includes(writeTarget.action)) return false
    return (
      this.collection.includes('*') ||
      (this.collection as readonly string[]).includes(writeTarget.collection)
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
    const collectionIndependent =
      options.action === 'read' || options.action === 'manage'
    return SpacePermission.parser.format({
      type: options.type as SpaceTypeParam,
      did: options.did as SpaceDidParam,
      skey: options.skey as SpaceSkeyParam | '*',
      collection: collectionIndependent
        ? ([] as unknown as NeRoArray<SpaceCollectionParam>)
        : [
            (options as { collection: string })
              .collection as SpaceCollectionParam,
          ],
      action: [options.action],
    })
  }
}

function includedIn<T>(this: readonly T[], value: T): boolean {
  return this.includes(value)
}
