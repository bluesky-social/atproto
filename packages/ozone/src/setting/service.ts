import assert from 'node:assert'
import type { Selectable } from 'kysely'
import { toDatetimeString } from '@atproto/lex'
import type { DidString, LexMap, NsidString } from '@atproto/lex'
import { InvalidRequestError } from '@atproto/xrpc-server'
import type { Database } from '../db/index.js'
import type { Member } from '../db/schema/member.js'
import type { Setting, SettingScope } from '../db/schema/setting.js'
import type { tools } from '../lexicons/index.js'

export type SettingServiceCreator = (db: Database) => SettingService

export class SettingService {
  constructor(public db: Database) {}

  static creator() {
    return (db: Database) => new SettingService(db)
  }

  async query({
    limit = 100,
    scope,
    did,
    cursor,
    prefix,
    keys,
  }: {
    limit: number
    scope?: 'personal' | 'instance'
    did?: DidString
    cursor?: string
    prefix?: string
    keys?: string[]
  }): Promise<{
    options: Selectable<Setting>[]
    cursor?: string
  }> {
    let builder = this.db.db.selectFrom('setting').selectAll()

    if (prefix) {
      builder = builder.where('key', 'like', `${prefix}%`)
    } else if (keys?.length) {
      builder = builder.where('key', 'in', keys)
    }

    if (scope) {
      builder = builder.where('scope', '=', scope)
    }

    if (did) {
      builder = builder.where('did', '=', did)
    }

    if (cursor) {
      const cursorId = parseInt(cursor, 10)
      if (isNaN(cursorId)) {
        throw new InvalidRequestError('invalid cursor')
      }
      builder = builder.where('id', '<', cursorId)
    }

    const options = await builder.orderBy('id', 'desc').limit(limit).execute()

    return {
      options,
      cursor: options[options.length - 1]?.id.toString(),
    }
  }

  async upsert(
    option: Omit<Setting, 'id' | 'createdAt' | 'updatedAt'> & {
      createdAt: Date
      updatedAt: Date
    },
  ): Promise<void> {
    await this.db.db
      .insertInto('setting')
      .values(option)
      .onConflict((oc) => {
        return oc.columns(['key', 'scope', 'did']).doUpdateSet({
          value: option.value as LexMap,
          updatedAt: option.updatedAt,
          description: option.description,
          managerRole: option.managerRole,
          lastUpdatedBy: option.lastUpdatedBy,
        })
      })
      .execute()
  }

  async removeOptions(
    keys: string[],
    filters: {
      did?: DidString
      scope: SettingScope
      managerRole: Member['role'][]
    },
  ): Promise<void> {
    if (!keys.length) return

    if (filters.scope === 'personal') {
      assert(filters.did, 'did is required for personal scope')
    }

    let qb = this.db.db
      .deleteFrom('setting')
      .where('key', 'in', keys)
      .where('scope', '=', filters.scope)

    if (filters.managerRole.length) {
      qb = qb.where('managerRole', 'in', filters.managerRole)
    } else {
      qb = qb.where('managerRole', 'is', null)
    }

    if (filters.did) {
      qb = qb.where('did', '=', filters.did)
    }

    await qb.execute()
  }

  view(setting: Selectable<Setting>): tools.ozone.setting.defs.Option {
    const {
      key,
      value,
      did,
      description,
      createdAt,
      createdBy,
      updatedAt,
      lastUpdatedBy,
      managerRole,
      scope,
    } = setting

    return {
      key: key as NsidString,
      value: value as LexMap,
      did,
      scope,
      createdBy,
      lastUpdatedBy,
      managerRole: managerRole || undefined,
      description: description || undefined,
      createdAt: toDatetimeString(createdAt),
      updatedAt: toDatetimeString(updatedAt),
    }
  }
}
