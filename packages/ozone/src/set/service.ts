import Database from '../db'
import { Selectable, sql } from 'kysely'
import { OzoneSet } from '../db/schema/ozone_set'
import { SetView } from '../lexicon/types/tools/ozone/sets/defs'

export type SetServiceCreator = (db: Database) => SetService

export class SetService {
  constructor(public db: Database) {}

  static creator() {
    return (db: Database) => new SetService(db)
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
    sets: Selectable<OzoneSet & { setSize: number }>[]
    cursor?: string
  }> {
    let qb = this.db.db
      .selectFrom('ozone_set as s')
      .leftJoin(
        (eb) =>
          eb
            .selectFrom('ozone_set_value')
            .select(['setId'])
            .select((eb) => eb.fn.count('id').as('count'))
            .groupBy('setId')
            .as('sv'),
        (join) => join.onRef('sv.setId', '=', 's.id'),
      )
      .select([
        's.id',
        's.name',
        's.description',
        's.createdAt',
        's.updatedAt',
        sql<number>`coalesce(sv.count, 0)`.as('setSize'),
      ])
      .limit(limit)

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

  async getByName(
    name: string,
    txn: Database,
  ): Promise<Selectable<OzoneSet> | undefined> {
    const query = txn.db
      .selectFrom('ozone_set')
      .selectAll()
      .where('name', '=', name)

    return await query.executeTakeFirst()
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
    { set: Selectable<OzoneSet>; values: string[]; cursor?: string } | undefined
  > {
    const set = await this.getByName(name, this.db)
    if (!set) return undefined

    let qb = this.db.db
      .selectFrom('ozone_set_value')
      .select(['value'])
      .where('setId', '=', set.id)
      .limit(limit)

    if (cursor) {
      qb = qb.where('value', '>', cursor)
    }

    qb = qb.orderBy('value', 'asc')

    const values = await qb.execute()

    return {
      set,
      values: values.map((v) => v.value),
      cursor: values.at(-1)?.value,
    }
  }
  async upsert(
    { name, description }: Pick<OzoneSet, 'name' | 'description'>,
    txn: Database,
  ): Promise<Selectable<OzoneSet>> {
    const query = txn.db
      .insertInto('ozone_set')
      .values({
        name,
        description,
        updatedAt: new Date(),
      })
      .onConflict((oc) =>
        oc.column('name').doUpdateSet({
          description,
          updatedAt: new Date(),
        }),
      )
      .returningAll()

    return await query.executeTakeFirstOrThrow()
  }

  async addValues(
    setId: number,
    values: string[],
    txn: Database,
  ): Promise<void> {
    const query = txn.db
      .insertInto('ozone_set_value')
      .values(values.map((value) => ({ setId, value })))
      .onConflict((oc) => oc.columns(['setId', 'value']).doNothing())

    await query.execute()

    // Update the set's updatedAt timestamp
    await txn.db
      .updateTable('ozone_set')
      .set({ updatedAt: new Date() })
      .where('id', '=', setId)
      .execute()
  }

  async removeValues(
    setId: number,
    values: string[],
    txn: Database,
  ): Promise<void> {
    const query = txn.db
      .deleteFrom('ozone_set_value')
      .where('setId', '=', setId)
      .where('value', 'in', values)

    await query.execute()

    // Update the set's updatedAt timestamp
    await txn.db
      .updateTable('ozone_set')
      .set({ updatedAt: new Date() })
      .where('id', '=', setId)
      .execute()
  }

  async deleteSet(setId: number, txn: Database): Promise<void> {
    await txn.db.deleteFrom('ozone_set').where('id', '=', setId).execute()
    await txn.db
      .deleteFrom('ozone_set_value')
      .where('setId', '=', setId)
      .execute()
  }

  view(set: Selectable<OzoneSet> & { setSize: number }): SetView {
    return {
      name: set.name,
      description: set.description || undefined,
      setSize: set.setSize,
      createdAt: set.createdAt.toISOString(),
      updatedAt: set.updatedAt.toISOString(),
    }
  }
}
