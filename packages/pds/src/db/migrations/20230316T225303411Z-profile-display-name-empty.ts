import { Kysely, sql } from 'kysely'

// Goal here is just to make displayName nullable. Need to recreate table due to dqlite limitations.

export async function up(db: Kysely<Schema>, dialect): Promise<void> {
  // Drop old indices
  await db.schema.dropIndex('profile_creator_idx').execute()
  if (dialect === 'pg') {
    await db.schema.dropIndex('profile_display_name_tgrm_idx').execute()
  }
  // Create table w/ change
  await db.schema
    .createTable('profile_temp')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('displayName', 'varchar') // <-- change is here, making displayName nullable
    .addColumn('description', 'varchar')
    .addColumn('avatarCid', 'varchar')
    .addColumn('bannerCid', 'varchar')
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()
  // Fill table
  await db
    .insertInto('profile_temp')
    .columns(profileColumns)
    .expression((exp) => exp.selectFrom('profile').select(profileColumns))
    .execute()
  // Replace table by name
  await db.schema.dropTable('profile').execute()
  await db.schema.alterTable('profile_temp').renameTo('profile').execute()
  // Recreate indices
  await db.schema // Supports profile views
    .createIndex('profile_creator_idx')
    .on('profile')
    .column('creator')
    .execute()
  if (dialect === 'pg') {
    await db.schema // Supports user search
      .createIndex(`profile_display_name_tgrm_idx`)
      .on('profile')
      .using('gist')
      .expression(sql`"displayName" gist_trgm_ops`)
      .execute()
  }
}

export async function down(db: Kysely<Schema>, dialect): Promise<void> {
  // Drop old indices
  await db.schema.dropIndex('profile_creator_idx').execute()
  if (dialect === 'pg') {
    await db.schema.dropIndex('profile_display_name_tgrm_idx').execute()
  }
  // Create table w/ change
  await db.schema
    .createTable('profile_temp')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('displayName', 'varchar', (col) => col.notNull()) // <-- change is here, making displayName non-nullable again
    .addColumn('description', 'varchar')
    .addColumn('avatarCid', 'varchar')
    .addColumn('bannerCid', 'varchar')
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()
  // Fill table
  await db
    .insertInto('profile_temp')
    .columns(profileColumns)
    .expression((exp) => exp.selectFrom('profile').select(profileColumns))
    .execute()
  // Replace table by name
  await db.schema.dropTable('profile').execute()
  await db.schema.alterTable('profile_temp').renameTo('profile').execute()
  // Recreate indices
  await db.schema
    .createIndex('profile_creator_idx')
    .on('profile')
    .column('creator')
    .execute()
  if (dialect === 'pg') {
    await db.schema // Supports user search
      .createIndex(`profile_display_name_tgrm_idx`)
      .on('profile')
      .using('gist')
      .expression(sql`"displayName" gist_trgm_ops`)
      .execute()
  }
}

type Schema = {
  profile: Profile
  profile_temp: ProfileTemp
}

type Profile = {
  uri: string
  cid: string
  creator: string
  displayName: string
  description: string | null
  avatarCid: string | null
  bannerCid: string | null
  indexedAt: string
}

type ProfileTemp = Omit<Profile, 'displayName'> & {
  displayName: string | null
}

const profileColumns: (keyof Profile)[] = [
  'uri',
  'cid',
  'creator',
  'displayName',
  'description',
  'avatarCid',
  'bannerCid',
  'indexedAt',
]
