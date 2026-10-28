import { type Kysely, sql } from 'kysely'

// The simplespace config as it stood before this migration.
type SimplespaceConfig = {
  uri: string
  readPolicy: string // 'public' | 'member-list' | 'managing-app'
  readManagingApp: string | null
  writePolicy: string // 'public' | 'member-list' | 'managing-app'
  writeManagingApp: string | null
  appAccessType: string // 'open' | 'allowList'
  appAllowed: string // JSON-encoded string[]
}

type Policy = { $type: string; [key: string]: unknown }

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('space_policy')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('policyJson', 'text', (col) => col.notNull())
    .execute()

  const { rows } = await sql<SimplespaceConfig>`
    select * from simplespace_config
  `.execute(db)
  for (const config of rows) {
    const policy = configToPolicy(config)
    await sql`
      insert into space_policy (uri, policyJson)
      values (${config.uri}, ${JSON.stringify(policy)})
    `.execute(db)
    // The member list belongs to the memberspace policy.
    if (policy.$type !== 'com.atproto.memberspace.policy') {
      await sql`
        delete from simplespace_member where space = ${config.uri}
      `.execute(db)
    }
  }

  await db.schema.dropTable('simplespace_config').execute()
  await db.schema
    .alterTable('simplespace_member')
    .renameTo('memberspace_member')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('memberspace_member')
    .renameTo('simplespace_member')
    .execute()
  await db.schema
    .createTable('simplespace_config')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('readPolicy', 'varchar', (col) => col.notNull())
    .addColumn('readManagingApp', 'varchar')
    .addColumn('writePolicy', 'varchar', (col) => col.notNull())
    .addColumn('writeManagingApp', 'varchar')
    .addColumn('appAccessType', 'varchar', (col) => col.notNull())
    .addColumn('appAllowed', 'text', (col) => col.notNull())
    .execute()

  const { rows } = await sql<{ uri: string; policyJson: string }>`
    select * from space_policy
  `.execute(db)
  for (const row of rows) {
    const config = policyToConfig(row.uri, JSON.parse(row.policyJson))
    await sql`
      insert into simplespace_config (
        uri, readPolicy, readManagingApp, writePolicy, writeManagingApp,
        appAccessType, appAllowed
      )
      values (
        ${config.uri}, ${config.readPolicy}, ${config.readManagingApp},
        ${config.writePolicy}, ${config.writeManagingApp},
        ${config.appAccessType}, ${config.appAllowed}
      )
    `.execute(db)
  }

  await db.schema.dropTable('space_policy').execute()
}

// A managing app on either side becomes a managedspace, which asks the app about
// both reads and writes. Anything else becomes a memberspace.
function configToPolicy(config: SimplespaceConfig): Policy {
  const allowedApps =
    config.appAccessType === 'allowList'
      ? JSON.parse(config.appAllowed)
      : undefined
  const managingApp = config.readManagingApp ?? config.writeManagingApp
  if (managingApp) {
    return {
      $type: 'com.atproto.managedspace.policy',
      managingApp,
      allowedApps,
      publishPolicy: false,
    }
  }
  return {
    $type: 'com.atproto.memberspace.policy',
    readAccess: config.readPolicy === 'public' ? 'public' : 'members',
    writeAccess: config.writePolicy === 'public' ? 'public' : 'members',
    allowedApps,
    publishPolicy: false,
    publishMembers: false,
  }
}

function policyToConfig(uri: string, policy: Policy): SimplespaceConfig {
  const allowedApps = policy.allowedApps as string[] | undefined
  const appAccessConfig = {
    appAccessType: allowedApps ? 'allowList' : 'open',
    appAllowed: JSON.stringify(allowedApps ?? []),
  }
  if (policy.$type === 'com.atproto.managedspace.policy') {
    const managingApp = policy.managingApp as string
    return {
      uri,
      readPolicy: 'managing-app',
      readManagingApp: managingApp,
      writePolicy: 'managing-app',
      writeManagingApp: managingApp,
      ...appAccessConfig,
    }
  }
  // A personalspace becomes a member-list space with no members, which admits
  // only the authority.
  return {
    uri,
    readPolicy: policy.readAccess === 'public' ? 'public' : 'member-list',
    readManagingApp: null,
    writePolicy: policy.writeAccess === 'public' ? 'public' : 'member-list',
    writeManagingApp: null,
    ...appAccessConfig,
  }
}
