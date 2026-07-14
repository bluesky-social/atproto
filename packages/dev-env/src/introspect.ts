import events from 'node:events'
import type http from 'node:http'
import express from 'express'
// eslint-disable-next-line import/default
import httpTerminator from 'http-terminator'
import type { TestBsky } from './bsky.js'
import type { TestBsync } from './bsync.js'
import type { TestOzone } from './ozone.js'
import type { TestPds } from './pds.js'
import type { TestPlc } from './plc.js'

export class IntrospectServer {
  private terminator: httpTerminator.HttpTerminator
  constructor(
    public port: number,
    public server: http.Server,
  ) {
    this.terminator = httpTerminator.createHttpTerminator({ server })
  }

  static async start(
    port: number,
    plc: TestPlc,
    pds: TestPds,
    bsync: TestBsync,
    bsky: TestBsky,
    ozone: TestOzone,
  ) {
    const app = express()
    app.get('/', (_req, res) => {
      res.status(200).send({
        plc: {
          url: plc.url,
        },
        pds: {
          url: pds.url,
          did: pds.ctx.cfg.service.did,
        },
        bsync: {
          url: bsync.url,
        },
        bsky: {
          url: bsky.url,
          did: bsky.ctx.cfg.serverDid,
        },
        ozone: {
          url: ozone.url,
          did: ozone.ctx.cfg.service.did,
        },
        db: {
          url: ozone.ctx.cfg.db.postgresUrl,
        },
      })
    })
    const server = app.listen(port)
    await events.once(server, 'listening')
    return new IntrospectServer(port, server)
  }

  async close() {
    await this.terminator.terminate()
  }
}
