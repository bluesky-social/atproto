import events from 'node:events'
import http from 'node:http'
import { AddressInfo } from 'node:net'
import compression from 'compression'
import cors from 'cors'
import express from 'express'
// eslint-disable-next-line import/default, import/no-named-as-default-member
import httpTerminator from 'http-terminator'
import * as prometheus from 'prom-client'
// eslint-disable-next-line import/no-named-as-default-member
const { createHttpTerminator } = httpTerminator
type HttpTerminator = ReturnType<typeof createHttpTerminator>
import { DAY, SECOND } from '@atproto/common'
import { extractUrlNsid } from '@atproto/xrpc-server'
import API, { health, wellKnown } from './api/index.js'
import { OzoneConfig, OzoneSecrets } from './config/index.js'
import { AppContext, AppContextOptions } from './context.js'
import { Member } from './db/schema/member.js'
import * as error from './error.js'
import { createServer } from './lexicon/index.js'
import { dbLogger, loggerMiddleware } from './logger.js'

export * from './config/index.js'
export { type ImageInvalidator } from './image-invalidator.js'
export { Database } from './db/index.js'
export { EventPusher, EventReverser, OzoneDaemon } from './daemon/index.js'
export { AppContext } from './context.js'
export { httpLogger } from './logger.js'

export class OzoneService {
  public ctx: AppContext
  public app: express.Application
  public server?: http.Server
  private terminator?: HttpTerminator
  private dbStatsInterval?: NodeJS.Timeout

  constructor(opts: { ctx: AppContext; app: express.Application }) {
    this.ctx = opts.ctx
    this.app = opts.app
  }

  static async create(
    cfg: OzoneConfig,
    secrets: OzoneSecrets,
    overrides?: Partial<AppContextOptions>,
    // Optional Prometheus registry. Its presence is the collection gate: when
    // omitted (dev-env, tests, self-hosted distros that don't opt in), no
    // metrics are collected and no per-request timing overhead is incurred.
    register?: prometheus.Registry,
  ): Promise<OzoneService> {
    const app = express()
    app.set('trust proxy', true)
    app.use(cors({ maxAge: DAY / SECOND }))
    app.use(loggerMiddleware)
    app.use(compression())

    if (register) {
      // Collect standard metrics on the nodejs runtime (GC, event loop, etc).
      prometheus.collectDefaultMetrics({ prefix: 'ozone_', register })

      // Per-XRPC-method request timing. Labeled by nsid (e.g.
      // tools.ozone.moderation.emitEvent) so every method is covered without
      // per-endpoint code. This middleware runs above the xrpc router, so
      // req.route is not yet populated; we derive the nsid from the URL instead.
      const xrpcRequestDuration = new prometheus.Histogram({
        name: 'ozone_xrpc_request_duration_seconds',
        help: 'XRPC request duration in seconds, by method',
        labelNames: ['nsid', 'method', 'code'],
        registers: [register],
      })

      app.use((req, res, next) => {
        const nsid = extractUrlNsid(req.originalUrl)
        // Only record xrpc methods; non-xrpc paths (health, robots, frontend)
        // are skipped to keep the metric's label cardinality bounded.
        if (!nsid) return next()
        const end = xrpcRequestDuration.startTimer()
        res.on('finish', () => {
          end({
            nsid,
            method: req.method,
            code: res.statusCode,
          })
        })
        next()
      })
    }

    const ctx = await AppContext.fromConfig(cfg, secrets, overrides)

    let server = createServer({
      validateResponse: false,
      payload: {
        jsonLimit: 100 * 1024, // 100kb
        textLimit: 100 * 1024, // 100kb
        blobLimit: 5 * 1024 * 1024, // 5mb
      },
    })

    server = API(server, ctx)

    app.use(health.createRouter(ctx))
    app.use(wellKnown.createRouter(ctx))
    app.use(server.xrpc.router)
    app.use(error.handler)

    return new OzoneService({ ctx, app })
  }

  async seedInitialMembers() {
    const members: Array<{ role: Member['role']; did: string }> = []
    this.ctx.cfg.access.admins.forEach((did) =>
      members.push({
        role: 'tools.ozone.team.defs#roleAdmin',
        did,
      }),
    )
    this.ctx.cfg.access.triage.forEach((did) =>
      members.push({
        role: 'tools.ozone.team.defs#roleTriage',
        did,
      }),
    )
    this.ctx.cfg.access.moderators.forEach((did) =>
      members.push({
        role: 'tools.ozone.team.defs#roleModerator',
        did,
      }),
    )

    for (const member of members) {
      const service = this.ctx.teamService(this.ctx.db)
      await service.upsert({
        ...member,
        lastUpdatedBy: this.ctx.cfg.service.did,
      })
    }
  }

  async start(): Promise<http.Server> {
    if (this.dbStatsInterval) {
      throw new Error(`${this.constructor.name} already started`)
    }

    // Any moderator that are configured via env var may not exist in the database
    // so we need to sync them from env var to the database
    await this.seedInitialMembers()

    const { db, backgroundQueue } = this.ctx
    this.dbStatsInterval = setInterval(() => {
      dbLogger.info(
        {
          idleCount: db.pool.idleCount,
          totalCount: db.pool.totalCount,
          waitingCount: db.pool.waitingCount,
        },
        'db pool stats',
      )
      dbLogger.info(backgroundQueue.getStats(), 'background queue stats')
    }, 10000)
    await this.ctx.sequencer.start()
    const server = this.app.listen(this.ctx.cfg.service.port)
    this.server = server
    server.keepAliveTimeout = 90000
    this.terminator = createHttpTerminator({ server })
    await events.once(server, 'listening')
    const { port } = server.address() as AddressInfo
    this.ctx.assignPort(port)
    return server
  }

  async destroy(): Promise<void> {
    await this.terminator?.terminate()
    await this.ctx.backgroundQueue.destroy()
    await this.ctx.sequencer.destroy()
    await this.ctx.db.close()
    clearInterval(this.dbStatsInterval)
    this.dbStatsInterval = undefined
  }
}

export type MetricsServiceOpts = {
  // Optional readiness probe. Should reject/throw when the service cannot serve
  // traffic (e.g. database unreachable). When omitted, /readyz behaves like
  // /livez (process-alive only).
  readinessCheck?: () => Promise<void>
}

// A separate, pull-based Prometheus metrics server. Kept on its own port and
// HTTP server so private metrics and ops probes are never exposed on the public
// ozone server. Only started by an entrypoint when metrics are explicitly
// opted in. Also serves Kubernetes-style liveness (/livez) and readiness
// (/readyz) probes.
export class MetricsService {
  private terminator?: HttpTerminator

  constructor(public app: express.Application) {}

  static create(
    register: prometheus.Registry,
    opts: MetricsServiceOpts = {},
  ): MetricsService {
    const app = express()

    app.get('/metrics', async (_req, res) => {
      res.set('Content-Type', register.contentType)
      res.end(await register.metrics())
    })

    // Liveness: is the process up and the event loop responsive? No external
    // dependencies, so a transient dependency outage never causes a pod restart.
    app.get('/livez', (_req, res) => {
      res.send({ status: 'ok' })
    })

    // Readiness: can the service handle traffic right now? Runs the optional
    // readiness check (e.g. a db ping); a failure pulls the pod from the load
    // balancer without restarting it.
    app.get('/readyz', async (_req, res) => {
      if (!opts.readinessCheck) {
        return res.send({ status: 'ok' })
      }
      try {
        await opts.readinessCheck()
        res.send({ status: 'ok' })
      } catch {
        res.status(503).send({ status: 'not ready' })
      }
    })

    return new MetricsService(app)
  }

  async start(port: number): Promise<http.Server> {
    const server = this.app.listen(port)
    server.keepAliveTimeout = 90000
    this.terminator = createHttpTerminator({ server })
    await events.once(server, 'listening')
    return server
  }

  async destroy(): Promise<void> {
    await this.terminator?.terminate()
  }
}

export default OzoneService
