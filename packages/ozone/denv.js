/* eslint-env node */

'use strict'

const {
  Database,
  OzoneService,
  envToCfg,
  envToSecrets,
  httpLogger,
  readEnv,
} = require('./dist')

const main = async () => {
  const env = readEnv()
  const cfg = envToCfg(env)
  const secrets = envToSecrets(env)

  const migrate = process.env.OZONE_DB_MIGRATE === '1'
  if (migrate) {
    const db = new Database({
      url: cfg.db.postgresUrl,
      schema: cfg.db.postgresSchema,
    })
    await db.migrateToLatestOrThrow()
    await db.close()
  }

  const ozone = await OzoneService.create(cfg, secrets)

  await ozone.start()

  httpLogger.info('ozone is running')
}

main()
