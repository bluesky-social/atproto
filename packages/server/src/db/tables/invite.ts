import { Kysely } from 'kysely'

export interface InviteCode {
  code: string
  availableUses: number
  disabled: 0 | 1
  forUser: string
  createdBy: string
  createdAt: string
}

export interface InviteCodeUse {
  code: string
  usedBy: string
  usedAt: string
}

export const tableName = 'invite_code'
export const supportingTableName = 'invite_code_use'

export type PartialDB = {
  [tableName]: InviteCode
  [supportingTableName]: InviteCodeUse
}

export const createTable = async (db: Kysely<PartialDB>): Promise<void> => {
  await db.schema
    .createTable(tableName)
    .addColumn('code', 'varchar', (col) => col.primaryKey())
    .addColumn('availableUses', 'integer', (col) => col.notNull())
    .addColumn('disabled', 'int2', (col) => col.defaultTo(0))
    .addColumn('forUser', 'varchar', (col) => col.notNull())
    .addColumn('createdBy', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .execute()

  await db.schema
    .createTable(supportingTableName)
    .addColumn('code', 'varchar', (col) => col.notNull())
    .addColumn('usedBy', 'varchar', (col) => col.notNull())
    .addColumn('usedAt', 'varchar', (col) => col.notNull())
    // Index names need to be unique per schema for postgres
    .addPrimaryKeyConstraint(`${supportingTableName}_pkey`, ['code', 'usedBy'])
    .execute()
}
