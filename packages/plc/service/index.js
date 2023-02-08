'use strict' /* eslint-disable */

require('dd-trace/init') // Only works with commonjs
const { Database, PlcServer } = require('..')

const main = async () => {
  const version = process.env.PLC_VERSION
  const dbCreds = JSON.parse(process.env.DB_CREDS_JSON)
  const dbMigrateCreds = JSON.parse(process.env.DB_MIGRATE_CREDS_JSON)
  const dbSchema = process.env.DB_SCHEMA || undefined
  // Migrate using credentialed user
  const migrateDb = Database.postgres({
    url: pgUrl(dbMigrateCreds),
    schema: dbSchema,
  })
  await migrateDb.migrateToLatestOrThrow()
  await migrateDb.close()
  // Use lower-credentialed user to run the app
  const db = Database.postgres({
    url: pgUrl(dbCreds),
    schema: dbSchema,
  })
  const port = parseInt(process.env.PORT)
  const plc = PlcServer.create({ db, port, version })
  await plc.start()
  // Graceful shutdown (see also https://aws.amazon.com/blogs/containers/graceful-shutdowns-with-ecs/)
  process.on('SIGTERM', async () => {
    await plc.destroy()
  })
}

const pgUrl = ({ username, password, host, port }) => {
  const enc = encodeURIComponent
  return `postgresql://${username}:${enc(password)}@${host}:${port}/postgres`
}

main()
