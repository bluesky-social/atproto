import events from 'node:events'
import http from 'node:http'
import express from 'express'
import { TestBsky } from './bsky'
import { TestOzone } from './ozone'
import { TestPds } from './pds'
import { TestPlc } from './plc'

export type LexiconAuthorityIntrospection = {
  did: string
  handle: string
  password: string
  /** PDS URL hosting the authority account. */
  pds: string
}

export class IntrospectServer {
  constructor(
    public port: number,
    public server: http.Server,
  ) {}

  static async start(
    port: number,
    plc: TestPlc,
    pds: TestPds | TestPds[],
    bsky?: TestBsky,
    ozone?: TestOzone,
    lexiconAuthority?: LexiconAuthorityIntrospection,
  ) {
    const pdses = Array.isArray(pds) ? pds : [pds]
    const app = express()
    app.get('/', (_req, res) => {
      res.status(200).send({
        plc: {
          url: plc.url,
        },
        // For backwards compat the first PDS is exposed at "pds"; all PDSes
        // (including the first) are exposed at "pdses".
        pds: {
          url: pdses[0].url,
          did: pdses[0].ctx.cfg.service.did,
        },
        pdses: pdses.map((p) => ({
          url: p.url,
          did: p.ctx.cfg.service.did,
          handleDomains: p.ctx.cfg.identity.serviceHandleDomains,
        })),
        bsky: bsky
          ? {
              url: bsky.url,
              did: bsky.ctx.cfg.serverDid,
            }
          : undefined,
        ozone: ozone
          ? {
              url: ozone.url,
              did: ozone.ctx.cfg.service.did,
            }
          : undefined,
        db: ozone
          ? {
              url: ozone.ctx.cfg.db.postgresUrl,
            }
          : undefined,
        // Credentials for the dev-env lex authority. Demo apps log in here to
        // publish lexicon docs (permission sets, space declarations) that the
        // PDSes will resolve via `lexiconDidAuthority`.
        lexiconAuthority,
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
