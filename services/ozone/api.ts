import * as prometheus from 'prom-client'
import {
  BunnyInvalidator,
  CloudfrontInvalidator,
  MultiImageInvalidator,
} from '@atproto/aws'
import {
  Database,
  MetricsService,
  OzoneService,
  envToCfg,
  envToSecrets,
  httpLogger,
  readEnv,
} from '@atproto/ozone'

const main = async () => {
  const env = readEnv()
  const cfg = envToCfg(env)
  const secrets = envToSecrets(env)

  // configure zero, one, or more image invalidators
  const imgUriEndpoint = process.env.OZONE_IMG_URI_ENDPOINT ?? ''
  const bunnyAccessKey = process.env.OZONE_BUNNY_ACCESS_KEY
  const cfDistributionId = process.env.OZONE_CF_DISTRIBUTION_ID

  const imgInvalidators: (BunnyInvalidator | CloudfrontInvalidator)[] = []

  if (bunnyAccessKey) {
    imgInvalidators.push(
      new BunnyInvalidator({
        accessKey: bunnyAccessKey,
        urlPrefix: imgUriEndpoint,
      }),
    )
  }

  if (cfDistributionId) {
    imgInvalidators.push(
      new CloudfrontInvalidator({
        distributionId: cfDistributionId,
        pathPrefix: imgUriEndpoint && new URL(imgUriEndpoint).pathname,
      }),
    )
  }

  const imgInvalidator =
    imgInvalidators.length > 1
      ? new MultiImageInvalidator(imgInvalidators)
      : imgInvalidators[0]

  const migrate = process.env.OZONE_DB_MIGRATE === '1'
  if (migrate) {
    const db = new Database({
      url: cfg.db.postgresUrl,
      schema: cfg.db.postgresSchema,
    })
    await db.migrateToLatestOrThrow()
    await db.close()
  }

  // Metrics are opt-in via OZONE_METRICS_PORT. When unset, no registry is
  // created and OzoneService.create collects nothing.
  const register = cfg.service.metricsPort
    ? new prometheus.Registry()
    : undefined

  const ozone = await OzoneService.create(
    cfg,
    secrets,
    { imgInvalidator },
    register,
  )

  await ozone.start()

  httpLogger.info('ozone is running')

  let metrics: MetricsService | undefined
  if (register && cfg.service.metricsPort) {
    metrics = MetricsService.create(register)
    await metrics.start(cfg.service.metricsPort)
    httpLogger.info('ozone metrics is running')
  }

  // Graceful shutdown (see also https://aws.amazon.com/blogs/containers/graceful-shutdowns-with-ecs/)
  process.on('SIGTERM', async () => {
    httpLogger.info('ozone is stopping')

    await metrics?.destroy()
    await ozone.destroy()

    httpLogger.info('ozone is stopped')
  })
}

main()
