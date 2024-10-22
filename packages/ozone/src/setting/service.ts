import Database from '../db'
import { Selectable } from 'kysely'
import { Option } from '../lexicon/types/tools/ozone/setting/defs'
import { paginate, TimeIdKeyset } from '../db/pagination'
import { Setting, SettingManagerRole, SettingScope } from '../db/schema/setting'

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
    did?: string
    cursor?: string
    prefix?: string
    keys?: string[]
  }): Promise<{
    options: Selectable<Setting>[]
    cursor?: string
  }> {
    let builder = this.db.db.selectFrom('setting').selectAll()
    const { ref } = this.db.db.dynamic

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

    const keyset = new TimeIdKeyset(ref(`setting.createdAt`), ref('setting.id'))

    const paginatedBuilder = paginate(builder, {
      limit,
      cursor,
      keyset,
      direction: 'desc',
      tryIndex: true,
    })

    const options = await paginatedBuilder.execute()

    return {
      options,
      cursor: keyset.packFromResult(options),
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
        return oc.columns(['key', 'scope']).doUpdateSet({
          value: option.value,
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
      did?: string
      scope: SettingScope
      managerRole: SettingManagerRole[]
    },
  ): Promise<void> {
    if (!keys.length) return

    let qb = this.db.db
      .deleteFrom('setting')
      .where('key', 'in', keys)
      .where('scope', '=', filters.scope)
      .where(
        'managerRole',
        'in',
        filters.managerRole.length ? filters.managerRole : ['owner'],
      )

    if (filters.did) {
      qb = qb.where('did', '=', filters.did)
    }

    await qb.execute()
  }

  view(setting: Selectable<Setting>): Option {
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
      key,
      value,
      did,
      managerRole,
      scope,
      createdBy,
      lastUpdatedBy,
      description: description || undefined,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    }
  }
}
