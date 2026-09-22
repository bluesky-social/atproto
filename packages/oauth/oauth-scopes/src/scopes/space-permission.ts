import {
  type DidString,
  type NsidString,
  type RecordKeyString,
  isValidDid,
  isValidNsid,
  isValidRecordKey,
} from '@atproto/syntax'
import { Parser } from '../lib/parser.js'
import type { ResourcePermission } from '../lib/resource-permission.js'
import { ScopeStringSyntax } from '../lib/syntax-string.js'
import {
  type NeArray,
  type NeRoArray,
  type ScopeSyntax,
  isScopeStringFor,
} from '../lib/syntax.js'
import { knownValuesValidator } from '../lib/util.js'

export { type NsidString, isValidNsid as isNsidString }
export { type DidString, isValidDid as isDidString }

// @TODO these should probably be defined in the @atproto/syntax package
export type SpaceKeyString = RecordKeyString
export const isSpaceKeyString = isValidRecordKey

export const SPACE_ACTIONS = Object.freeze([
  'read_self',
  'read',
  'create',
  'update',
  'delete',
] as const)
export type SpaceAction = (typeof SPACE_ACTIONS)[number]
export const isSpaceAction = knownValuesValidator(SPACE_ACTIONS)

// `read_self` is omitted because `read` already implies it.
export const SPACE_DEFAULT_ACTIONS = Object.freeze([
  'read',
  'create',
  'update',
  'delete',
] as const)

export const SPACE_MANAGE_OPS = Object.freeze([
  'create',
  'update',
  'delete',
] as const)
export type SpaceManageOp = (typeof SPACE_MANAGE_OPS)[number]
export const isSpaceManageOp = knownValuesValidator(SPACE_MANAGE_OPS)

export type SpaceTypeParam = '*' | NsidString
export const isSpaceTypeParam = (value: unknown): value is SpaceTypeParam =>
  value === '*' || isValidNsid(value)

export type SpaceAuthorityParam = '*' | 'self' | DidString
export const isSpaceAuthorityParam = (
  value: unknown,
): value is SpaceAuthorityParam =>
  value === '*' || value === 'self' || isValidDid(value)

export type SpaceKeyParam = '*' | SpaceKeyString
export const isSpaceKeyParam = (value: unknown): value is SpaceKeyParam =>
  value === '*' || isSpaceKeyString(value)

export type SpaceCollectionParam = '*' | NsidString
export const isSpaceCollectionParam = (
  value: unknown,
): value is SpaceCollectionParam => value === '*' || isValidNsid(value)

export type SpacePermissionMatch = {
  type: SpaceTypeParam
  authority: SpaceAuthorityParam
  skey: SpaceKeyParam
} & (
  | {
      action: 'read'
      collection?: never
      manage?: never
    }
  | {
      action: 'read_self'
      collection?: never
      manage?: never
    }
  | {
      action: 'create' | 'update' | 'delete'
      collection: NsidString
      manage?: never
    }
  | {
      action?: never
      collection?: never
      manage: SpaceManageOp
    }
)

export class SpacePermission implements ResourcePermission<
  'space',
  SpacePermissionMatch
> {
  constructor(
    public readonly type: SpaceTypeParam,
    public readonly authority: SpaceAuthorityParam,
    public readonly skey: SpaceKeyParam,
    public readonly collection: NeRoArray<SpaceCollectionParam>,
    public readonly action: NeRoArray<SpaceAction>,
    public readonly manage: NeRoArray<SpaceManageOp>,
  ) {}

  matches(target: SpacePermissionMatch) {
    // An unresolved `self` authority matches nothing, since `target.authority`
    // is always a concrete DID.
    if (this.type !== '*' && this.type !== target.type) return false
    if (this.authority !== '*' && this.authority !== target.authority) {
      return false
    }
    if (this.skey !== '*' && this.skey !== target.skey) return false

    if (target.action === undefined) {
      return this.manage.includes(target.manage)
    }

    // Reads are collection-independent, and `read` implies `read_self`.
    if (target.action === 'read') {
      return this.action.includes('read')
    }
    if (target.action === 'read_self') {
      return this.action.includes('read') || this.action.includes('read_self')
    }

    return (
      this.action.includes(target.action) &&
      this.collectionAllows(target.collection)
    )
  }

  private collectionAllows(collection: string): boolean {
    return (
      this.collection.includes('*') ||
      (this.collection as readonly string[]).includes(collection)
    )
  }

  get hasCollections(): boolean {
    return this.collection.length > 0
  }

  /**
   * Materializes a space type's declared collections into a bare
   * `space:<type>` grant. Called at token-issuance time, since the matcher is
   * context-free and cannot resolve declarations itself.
   */
  withDefaultCollections(
    collections: readonly SpaceCollectionParam[],
  ): SpacePermission {
    if (this.hasCollections || collections.length === 0) return this
    return new SpacePermission(
      this.type,
      this.authority,
      this.skey,
      collections as NeRoArray<SpaceCollectionParam>,
      this.action,
      this.manage,
    )
  }

  get isSelfAuthority(): boolean {
    return this.authority === 'self'
  }

  /**
   * Resolves an `authority` of `self` to the granting user's DID. Called at
   * token-issuance time, alongside {@link withDefaultCollections}.
   */
  withResolvedAuthority(userDid: DidString): SpacePermission {
    if (this.authority !== 'self') return this
    return new SpacePermission(
      this.type,
      userDid,
      this.skey,
      this.collection,
      this.action,
      this.manage,
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
      authority: {
        multiple: false,
        required: false,
        default: 'self' as const,
        validate: isSpaceAuthorityParam,
      },
      skey: {
        multiple: false,
        required: false,
        default: '*' as const,
        validate: isSpaceKeyParam,
      },
      collection: {
        multiple: true,
        required: false,
        validate: isSpaceCollectionParam,
        // Empty means no write targets, not "all collections".
        default: [] as unknown as NeRoArray<SpaceCollectionParam>,
        normalize: (value) => {
          if (value.length > 1) {
            if (value.includes('*')) return ['*'] as const
            return [...new Set(value)].sort() as NeArray<NsidString>
          }
          return value as [SpaceCollectionParam]
        },
      },
      action: {
        multiple: true,
        required: false,
        validate: isSpaceAction,
        default: SPACE_DEFAULT_ACTIONS as unknown as NeRoArray<SpaceAction>,
        normalize: (value) =>
          SPACE_ACTIONS.filter(includedIn, value) as NeArray<SpaceAction>,
      },
      manage: {
        multiple: true,
        required: false,
        validate: isSpaceManageOp,
        default: [] as unknown as NeRoArray<SpaceManageOp>,
        normalize: (value) =>
          SPACE_MANAGE_OPS.filter(includedIn, value) as NeArray<SpaceManageOp>,
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
      result.authority,
      result.skey,
      result.collection,
      result.action,
      result.manage,
    )
  }

  static scopeNeededFor(options: SpacePermissionMatch): string {
    // Omitting `action` would default it to the full record action list, so
    // pair the verb with `read_self` — the narrowest action expressible — to
    // avoid suggesting read/write over every record.
    if ('manage' in options && options.manage != null) {
      return SpacePermission.parser.format({
        type: options.type,
        authority: options.authority,
        skey: options.skey,
        collection: [] as unknown as NeRoArray<SpaceCollectionParam>,
        action: ['read_self'],
        manage: [options.manage],
      })
    }

    return SpacePermission.parser.format({
      type: options.type,
      authority: options.authority,
      skey: options.skey,
      collection:
        options.action === 'read' || options.action === 'read_self'
          ? ([] as unknown as NeRoArray<SpaceCollectionParam>)
          : [options.collection],
      action: [options.action],
      manage: [] as unknown as NeRoArray<SpaceManageOp>,
    })
  }
}

function includedIn<T>(this: readonly T[], value: T): boolean {
  return this.includes(value)
}
