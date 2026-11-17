import {
  IncludeScope,
  type SpaceAuthorityParam,
  type SpaceKeyParam,
  SpacePermission,
  type SpaceTypeParam,
} from '@atproto/oauth-scopes'
import type {
  PermissionSets,
  Space,
  SpaceHandles,
  Spaces,
} from '#/hydration-data.d.ts'
import { isConventionalOAuthClientId } from './oauth-client.ts'

/**
 * How alarming a space grant is, least to most:
 *
 * - `client`: spaces run by the client's own operator. The authority's
 *   verified handle is the hostname of a conventional client id, so the app is
 *   only reaching spaces its operator already runs.
 * - `authority`: spaces run by one other, named authority.
 * - `broad`: one space type under any authority, or the spaces the user owns
 *   (`self`). Not tied to any service the user could recognize.
 * - `universal`: every space on the network.
 */
export const SPACE_ACCESS_LEVELS = Object.freeze([
  'client',
  'authority',
  'broad',
  'universal',
] as const)
export type SpaceAccessLevel = (typeof SPACE_ACCESS_LEVELS)[number]

export type SpaceAccessContext = {
  /**
   * The client requesting access. Without it, no grant is `client`-level.
   */
  clientId?: string
  spaces?: Spaces
  spaceHandles?: SpaceHandles
}

export type SpaceWriteCell = {
  create: boolean
  update: boolean
  delete: boolean
}

/**
 * The grants sharing one (type, authority, skey) tuple, merged.
 */
export type SpaceAccessRow = {
  key: string
  level: SpaceAccessLevel
  type: SpaceTypeParam
  space?: Space
  authority: SpaceAuthorityParam
  authorityHandle?: string
  skey: SpaceKeyParam
  read: boolean
  // `read_self` without `read`: only the user's own data in the space.
  readSelf: boolean
  manage: boolean
  // Keyed by collection NSID or '*'. Empty means no write targets.
  writes: Map<string, SpaceWriteCell>
}

/**
 * The space permissions among `scopes`, including those carried by any
 * `include:` scope whose permission set is known.
 */
export function listSpacePermissions(
  scopes: Iterable<string>,
  permissionSets?: PermissionSets,
): SpacePermission[] {
  const result: SpacePermission[] = []

  for (const scope of scopes) {
    const include = IncludeScope.fromString(scope)
    if (include) {
      const permissionSet = permissionSets?.[include.nsid]
      if (!permissionSet) continue
      for (const permission of include.toPermissions(permissionSet)) {
        if (permission instanceof SpacePermission) result.push(permission)
      }
      continue
    }

    const permission = SpacePermission.fromString(scope)
    if (permission) result.push(permission)
  }

  return result
}

export function spaceAccessLevel(
  permission: SpacePermission,
  { clientId, spaceHandles }: SpaceAccessContext = {},
): SpaceAccessLevel {
  if (permission.authority === '*') {
    return permission.spaceType === '*' ? 'universal' : 'broad'
  }

  if (permission.authority === 'self') return 'broad'

  const handle = spaceHandles?.[permission.authority]
  const hostname = clientHostname(clientId)
  if (handle && hostname && handle.toLowerCase() === hostname) return 'client'

  return 'authority'
}

/**
 * The hostname a client is known by, when the client id is conventional
 * enough for the consent screen to name the client by its hostname alone.
 */
export function clientHostname(clientId?: string): string | null {
  if (!clientId || !isConventionalOAuthClientId(clientId)) return null
  return new URL(clientId).hostname
}

export function buildSpaceAccessRows(
  permissions: Iterable<SpacePermission>,
  context: SpaceAccessContext = {},
): SpaceAccessRow[] {
  const map = new Map<string, SpaceAccessRow>()

  for (const raw of permissions) {
    const space =
      raw.spaceType !== '*' ? context.spaces?.[raw.spaceType] : undefined

    // Apply space declaration defaults before rendering.
    const parsed = space?.collections?.length
      ? raw.withDefaultCollections(space.collections)
      : raw

    const key = `${parsed.spaceType}|${parsed.authority}|${parsed.skey}`
    let row = map.get(key)
    if (!row) {
      row = {
        key,
        level: spaceAccessLevel(parsed, context),
        type: parsed.spaceType,
        space,
        authority: parsed.authority,
        authorityHandle:
          parsed.authority !== '*' && parsed.authority !== 'self'
            ? context.spaceHandles?.[parsed.authority]
            : undefined,
        skey: parsed.skey,
        read: false,
        readSelf: false,
        manage: false,
        writes: new Map(),
      }
      map.set(key, row)
    }

    if (parsed.action.includes('read')) row.read = true
    if (parsed.action.includes('read_self')) row.readSelf = true
    if (parsed.manage != null) row.manage = true

    // A collection only matters to the actions that write to it.
    const writes =
      parsed.action.includes('create') ||
      parsed.action.includes('update') ||
      parsed.action.includes('delete')

    if (parsed.collection && writes) {
      for (const coll of parsed.collection) {
        const cell = row.writes.get(coll) ?? {
          create: false,
          update: false,
          delete: false,
        }
        if (parsed.action.includes('create')) cell.create = true
        if (parsed.action.includes('update')) cell.update = true
        if (parsed.action.includes('delete')) cell.delete = true
        row.writes.set(coll, cell)
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key))
}

export function highestSpaceAccessLevel(
  rows: readonly SpaceAccessRow[],
): SpaceAccessLevel | null {
  let highest: SpaceAccessLevel | null = null
  for (const { level } of rows) {
    if (
      highest == null ||
      SPACE_ACCESS_LEVELS.indexOf(level) > SPACE_ACCESS_LEVELS.indexOf(highest)
    ) {
      highest = level
    }
  }
  return highest
}
