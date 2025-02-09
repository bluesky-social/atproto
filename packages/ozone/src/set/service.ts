import { Selectable } from 'kysely'
import { Database } from '../db'
import { TimeIdKeyset, paginate } from '../db/pagination'
import { SetDetail } from '../db/schema/ozone_set'
import { SetView } from '../lexicon/types/tools/ozone/set/defs'

export type SetServiceCreator = (db: Database) => SetService

export class SetService {
  constructor(public db: Database) {}

  static creator() {
    return (db: Database) => new SetService(db)
  }

  buildQueryForSetWithSize() {
    return this.db.db.selectFrom('set_detail as s').select([
      's.id',
      's.name',
      's.description',
      's.createdAt',
      's.updatedAt',
      (eb) =>
        eb
          .selectFrom('set_value')
          .select((e) => e.fn.count<number>('setId').as('count'))
          .whereRef('setId', '=', 's.id')
          .as('setSize'),
    ])
  }

  async query({
    limit,
    cursor,
    namePrefix,
    sortBy,
    sortDirection,
  }: {
    limit: number
    cursor?: string
    namePrefix?: string
    sortBy: 'name' | 'createdAt' | 'updatedAt'
    sortDirection: 'asc' | 'desc'
  }): Promise<{
    sets: Selectable<SetDetail & { setSize: number }>[]
    cursor?: string
  }> {
    let qb = this.buildQueryForSetWithSize().limit(limit)

    if (namePrefix) {
      qb = qb.where('s.name', 'like', `${namePrefix}%`)
    }

    if (cursor) {
      if (sortBy === 'name') {
        qb = qb.where('s.name', sortDirection === 'asc' ? '>' : '<', cursor)
      } else {
        qb = qb.where(
          `s.${sortBy}`,
          sortDirection === 'asc' ? '>' : '<',
          new Date(cursor),
        )
      }
    }

    qb = qb.orderBy(`s.${sortBy}`, sortDirection)

    const sets = await qb.execute()
    const lastItem = sets.at(-1)

    return {
      sets,
      cursor: lastItem
        ? sortBy === 'name'
          ? lastItem?.name
          : lastItem?.[sortBy].toISOString()
        : undefined,
    }
  }

  async getByName(name: string): Promise<Selectable<SetDetail> | undefined> {
    const query = this.db.db
      .selectFrom('set_detail')
      .selectAll()
      .where('name', '=', name)

    return await query.executeTakeFirst()
  }

  async getByNameWithSize(
    name: string,
  ): Promise<Selectable<SetDetail & { setSize: number }> | undefined> {
    return await this.buildQueryForSetWithSize()
      .where('s.name', '=', name)
      .executeTakeFirst()
  }

  async getSetWithValues({
    name,
    limit,
    cursor,
  }: {
    name: string
    limit: number
    cursor?: string
  }): Promise<
    | {
        set: Selectable<SetDetail & { setSize: number }>
        values: string[]
        cursor?: string
      }
    | undefined
  > {
    const set = await this.getByNameWithSize(name)
    if (!set) return undefined

    const { ref } = this.db.db.dynamic
    const qb = this.db.db
      .selectFrom('set_value')
      .selectAll()
      .where('setId', '=', set.id)

    const keyset = new TimeIdKeyset(ref(`createdAt`), ref('id'))
    const paginatedBuilder = paginate(qb, {
      limit,
      cursor,
      keyset,
      direction: 'asc',
    })

    const result = await paginatedBuilder.execute()

    return {
      set,
      values: result.map((v) => v.value),
      cursor: keyset.packFromResult(result),
    }
  }
  async upsert({
    name,
    description,
  }: Pick<SetDetail, 'name' | 'description'>): Promise<void> {
    await this.db.db
      .insertInto('set_detail')
      .values({
        name,
        description,
        updatedAt: new Date(),
      })
      .onConflict((oc) => {
        // if description is provided as a string, even an empty one, update it
        // otherwise, just update the updatedAt timestamp
        return oc.column('name').doUpdateSet(
          typeof description === 'string'
            ? {
                description,
                updatedAt: new Date(),
              }
            : { updatedAt: new Date() },
        )
      })
      .execute()
  }

  async addValues(setId: number, values: string[]): Promise<void> {
    await this.db.transaction(async (txn) => {
      const now = new Date()
      const query = txn.db
        .insertInto('set_value')
        .values(
          values.map((value) => ({
            setId,
            value,
            createdAt: now,
          })),
        )
        .onConflict((oc) => oc.columns(['setId', 'value']).doNothing())

      await query.execute()

      // Update the set's updatedAt timestamp
      await txn.db
        .updateTable('set_detail')
        .set({ updatedAt: now })
        .where('id', '=', setId)
        .execute()
    })
  }

  async removeValues(setId: number, values: string[]): Promise<void> {
    if (values.length < 1) {
      return
    }
    await this.db.transaction(async (txn) => {
      const query = txn.db
        .deleteFrom('set_value')
        .where('setId', '=', setId)
        .where('value', 'in', values)

      await query.execute()

      // Update the set's updatedAt timestamp
      await txn.db
        .updateTable('set_detail')
        .set({ updatedAt: new Date() })
        .where('id', '=', setId)
        .execute()
    })
  }

  async removeSet(setId: number): Promise<void> {
    await this.db.transaction(async (txn) => {
      await txn.db.deleteFrom('set_value').where('setId', '=', setId).execute()
      await txn.db.deleteFrom('set_detail').where('id', '=', setId).execute()
    })
  }

  view(set: Selectable<SetDetail> & { setSize: number }): SetView {
    return {
      name: set.name,
      description: set.description || undefined,
      setSize: set.setSize,
      createdAt: set.createdAt.toISOString(),
      updatedAt: set.updatedAt.toISOString(),
    }
  }
}
