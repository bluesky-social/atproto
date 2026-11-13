import * as prometheus from 'prom-client'
import {
  MetricsService,
  OzoneDaemon,
  envToCfg,
  envToSecrets,
  httpLogger,
  readEnv,
} from '@atproto/ozone'

const main = async () => {
  const env = readEnv()
  const cfg = envToCfg(env)
  const secrets = envToSecrets(env)

  // The daemon runs in its own process/container, so it needs its own metrics
  // server and scrape target. Opt-in via OZONE_DAEMON_METRICS_PORT; off by
  // default. The registry is built before create() so instrumented jobs (e.g.
  // the queue router) can register their metrics on it.
  let register: prometheus.Registry | undefined
  if (cfg.service.daemonMetricsPort) {
    register = new prometheus.Registry()
    prometheus.collectDefaultMetrics({ prefix: 'ozone_daemon_', register })
  }

  const daemon = await OzoneDaemon.create(cfg, secrets, undefined, register)

  await daemon.start()

  let metrics: MetricsService | undefined
  if (register && cfg.service.daemonMetricsPort) {
    metrics = MetricsService.create(register, {
      readinessCheck: () => daemon.ctx.db.ping(),
    })
    await metrics.start(cfg.service.daemonMetricsPort)
    httpLogger.info('ozone daemon metrics is running')
  }

  process.on('SIGTERM', async () => {
    await metrics?.destroy()
    await daemon.destroy()
  })
}

main()
