import events from 'node:events'
import http from 'node:http'
import express from 'express'
import { TestBsky } from './bsky.js'
import { TestOzone } from './ozone.js'
import { TestPds } from './pds.js'
import { TestPlc } from './plc.js'

export class IntrospectServer {
  constructor(
    public port: number,
    public server: http.Server,
  ) {}

  static async start(
    port: number,
    plc: TestPlc,
    pds: TestPds,
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
    this.server.close()
    await events.once(this.server, 'close')
  }
}
