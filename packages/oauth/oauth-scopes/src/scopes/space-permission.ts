import {
  type DidString,
  type NsidString,
  type RecordKeyString,
  type SpaceRefString,
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
  isNonEmpty,
  isScopeStringFor,
} from '../lib/syntax.js'
import { knownValuesValidator } from '../lib/util.js'

export {
  type DidString,
  type NsidString,
  isValidDid as isDidString,
  isValidNsid as isNsidString,
}

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

export type SpaceDidParam = '*' | 'self' | DidString
export const isSpaceDidParam = (value: unknown): value is SpaceDidParam =>
  value === '*' || value === 'self' || isValidDid(value)

export type SpaceKeyParam = '*' | SpaceKeyString
export const isSpaceKeyParam = (value: unknown): value is SpaceKeyParam =>
  value === '*' || isSpaceKeyString(value)

export type SpaceCollectionParam = '*' | NsidString
export const isSpaceCollectionParam = (
  value: unknown,
): value is SpaceCollectionParam => value === '*' || isValidNsid(value)

export type SpacePermissionMatchReference = {
  spaceType: SpaceTypeParam
  spaceDid: SpaceDidParam
  skey: SpaceKeyParam
}

/**
 * The space a permission check is about. A match reference may hold wildcards,
 * for checks that span several spaces (e.g. listing them).
 */
export type SpaceTarget = SpaceRefString | SpacePermissionMatchReference

export type SpacePermissionMatchOperation =
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
      /** `*` is matched only by a grant that covers every collection. */
      collection: SpaceCollectionParam
      manage?: never
    }
  | {
      action?: never
      collection?: never
      manage: SpaceManageOp
    }

export type SpacePermissionMatch = SpacePermissionMatchReference &
  SpacePermissionMatchOperation

export class SpacePermission implements ResourcePermission<
  'space',
  SpacePermissionMatch
> {
  constructor(
    public readonly spaceType: SpaceTypeParam,
    public readonly spaceDid: SpaceDidParam,
    public readonly skey: SpaceKeyParam,
    public readonly collection: undefined | NeRoArray<SpaceCollectionParam>,
    public readonly action: NeRoArray<SpaceAction>,
    public readonly manage: undefined | NeRoArray<SpaceManageOp>,
  ) {}

  matches(target: SpacePermissionMatch) {
    // An unresolved `self` space DID matches nothing, since `target.spaceDid`
    // is always a concrete DID.
    if (this.spaceType !== '*' && this.spaceType !== target.spaceType) {
      return false
    }
    if (this.spaceDid !== '*' && this.spaceDid !== target.spaceDid) {
      return false
    }
    if (this.skey !== '*' && this.skey !== target.skey) return false

    if (target.action == null) {
      return this.manage != null && this.manage.includes(target.manage)
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
    if (this.collection == null) return false
    return (
      this.collection.includes('*') ||
      (this.collection as readonly string[]).includes(collection)
    )
  }

  get hasCollections(): boolean {
    return this.collection != null
  }

  /**
   * Materializes a space type's declared collections into a bare
   * `space:<type>` grant. Called at token-issuance time, since the matcher is
   * context-free and cannot resolve declarations itself.
   */
  withDefaultCollections(
    collections: readonly SpaceCollectionParam[],
  ): SpacePermission {
    if (this.hasCollections) return this
    if (!isNonEmpty(collections)) return this
    return new SpacePermission(
      this.spaceType,
      this.spaceDid,
      this.skey,
      collections,
      this.action,
      this.manage,
    )
  }

  get isSelfSpaceDid(): boolean {
    return this.spaceDid === 'self'
  }

  /**
   * Resolves a `spaceDid` of `self` to the granting user's DID. Called at
   * token-issuance time, alongside {@link withDefaultCollections}.
   */
  withResolvedSpaceDid(userDid: DidString): SpacePermission {
    if (this.spaceDid !== 'self') return this
    return new SpacePermission(
      this.spaceType,
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
      spaceType: {
        multiple: false,
        required: true,
        validate: isSpaceTypeParam,
      },
      spaceDid: {
        multiple: false,
        required: false,
        default: 'self' as const,
        validate: isSpaceDidParam,
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
        default: undefined, // No collection means no write targets
        normalize: (value) => {
          if (value.length > 1) {
            if (value.includes('*')) return ['*'] as const
            return [...new Set(value)].sort() as NeArray<NsidString>
          }
          return value
        },
      },
      action: {
        multiple: true,
        required: false,
        validate: isSpaceAction,
        default: SPACE_DEFAULT_ACTIONS,
        normalize: (value) =>
          SPACE_ACTIONS.filter(includedIn, value) as NeArray<SpaceAction>,
      },
      manage: {
        multiple: true,
        required: false,
        validate: isSpaceManageOp,
        default: undefined, // No manage operations by default
        normalize: (value) =>
          SPACE_MANAGE_OPS.filter(includedIn, value) as NeArray<SpaceManageOp>,
      },
    },
    'spaceType',
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
      result.spaceType,
      result.spaceDid,
      result.skey,
      result.collection,
      result.action,
      result.manage,
    )
  }

  static scopeNeededFor(options: SpacePermissionMatch): string {
    return SpacePermission.parser.format(
      // 'manage' is disjoint from 'action'
      'manage' in options && options.manage != null
        ? {
            spaceType: options.spaceType,
            spaceDid: options.spaceDid,
            skey: options.skey,
            collection: undefined,
            action: ['read_self'], // Use the narrowest action to avoid suggesting broader permissions
            manage: [options.manage],
          }
        : {
            spaceType: options.spaceType,
            spaceDid: options.spaceDid,
            skey: options.skey,
            collection:
              options.action === 'read' || options.action === 'read_self'
                ? undefined
                : [options.collection],
            action: [options.action],
            manage: undefined,
          },
    )
  }
}

function includedIn<T>(this: readonly T[], value: T): boolean {
  return this.includes(value)
}
