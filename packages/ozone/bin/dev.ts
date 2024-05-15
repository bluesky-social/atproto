import * as dotenv from 'dotenv'
import OzoneService, {
  Database,
  envToCfg,
  envToSecrets,
  readEnv,
} from '../dist'

dotenv.config()

const run = async () => {
  process.env.OZONE_DB_POSTGRES_URL = process.env.DB_POSTGRES_URL
  const env = readEnv()
  const cfg = envToCfg(env)
  const secrets = envToSecrets(env)
  const migrateDb = new Database({
    url: cfg.db.postgresUrl,
    schema: cfg.db.postgresSchema,
  })
  await migrateDb.migrateToLatestOrThrow()
  await migrateDb.close()
  const server = await OzoneService.create(cfg, secrets)
  await server.start()
  console.log(`Ozone running on port ${cfg.service.port}`)
}

run()
