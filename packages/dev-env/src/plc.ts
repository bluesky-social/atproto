import events from 'node:events'
import {
  Client as PlcClient,
  type DocumentData,
  validateOperationLog,
} from '@did-plc/lib'
import * as plc from '@did-plc/server'
import express from 'express'
import { type HttpTerminator, createHttpTerminator } from 'http-terminator'
import getPort from './get-port.js'
import type { PlcConfig } from './types.js'

export class TestPlc {
  constructor(
    public url: string,
    public port: number,
    public server: plc.PlcServer,
    private terminator: HttpTerminator,
  ) {}

  static async create(cfg: PlcConfig): Promise<TestPlc> {
    const db = plc.Database.mock()
    const port = cfg.port || (await getPort())
    const url = `http://localhost:${port}`
    const server = plc.PlcServer.create({ db, port, ...cfg })

    // @NOTE The published @did-plc/server renders keys in the older per-curve
    // verification method formats, while plc.directory renders them as
    // Multikeys. DID documents are served here in the plc.directory format, and
    // everything else by the PLC server itself.
    const app = express()
    app.get('/:did', async (req, res, next) => {
      try {
        const doc = await getDidDoc(server, req.params.did)
        // Leave an unknown or tombstoned DID for the PLC server to answer.
        if (!doc) return next()
        // Allow any origin, as the PLC server does: browser apps resolve DIDs.
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.type('application/did+ld+json')
        res.send(JSON.stringify(doc))
      } catch (err) {
        next(err)
      }
    })
    app.use(server.app)

    const httpServer = app.listen(port)
    await events.once(httpServer, 'listening')
    const terminator = createHttpTerminator({ server: httpServer })
    return new TestPlc(url, port, server, terminator)
  }

  get ctx(): plc.AppContext {
    return this.server.ctx
  }

  getClient(): PlcClient {
    return new PlcClient(this.url)
  }

  async close() {
    await this.terminator.terminate()
    await this.server.destroy()
  }
}

async function getDidDoc(server: plc.PlcServer, did: string) {
  const log = await server.ctx.db.opsForDid(did)
  if (log.length === 0) return null
  const data = await validateOperationLog(did, log)
  return data && formatDidDoc(data)
}

function formatDidDoc(data: DocumentData) {
  return {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/multikey/v1',
    ],
    id: data.did,
    alsoKnownAs: data.alsoKnownAs,
    verificationMethod: Object.entries(data.verificationMethods).map(
      ([id, didKey]) => ({
        id: `#${id}`,
        type: 'Multikey',
        controller: data.did,
        publicKeyMultibase: didKey.slice('did:key:'.length),
      }),
    ),
    service: Object.entries(data.services).map(([id, service]) => ({
      id: `#${id}`,
      type: service.type,
      serviceEndpoint: service.endpoint,
    })),
  }
}
