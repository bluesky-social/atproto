import { finished } from 'node:stream/promises'
import express from 'express'
import { request } from 'undici'
import { AtUri, AtpAgent } from '@atproto/api'
import { randomStr } from '@atproto/crypto'
import { SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import { handler as errorHandler } from '../src/error'
import { startServer } from './_util'
import basicSeed from './seeds/basic'

describe('server', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient
  let alice: string

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'server',
      pds: {
        version: '0.0.0',
      },
    })
    agent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    alice = sc.dids.alice
  })

  afterAll(async () => {
    await network.close()
  })

  it('preserves 404s.', async () => {
    const res = await fetch(`${network.pds.url}/unknown`)
    expect(res.status).toEqual(404)
  })

  it('error handler turns unknown errors into 500s.', async () => {
    const app = express()
      .get('/oops', () => {
        throw new Error('Oops!')
      })
      .use(errorHandler)

    const { origin, stop } = await startServer(app)
    try {
      const res = await fetch(new URL(`/oops`, origin))
      expect(res.status).toEqual(500)
      await expect(res.json()).resolves.toEqual({
        error: 'InternalServerError',
        message: 'Internal Server Error',
      })
    } finally {
      await stop()
    }
  })

  it('limits size of json input.', async () => {
    const res = await fetch(
      `${network.pds.url}/xrpc/com.atproto.repo.createRecord`,
      {
        method: 'POST',
        body: '"' + 'x'.repeat(150 * 1024) + '"', // ~150kb
        headers: {
          ...sc.getHeaders(alice),
          'Content-Type': 'application/json',
        },
      },
    )

    expect(res.status).toEqual(413)
    await expect(res.json()).resolves.toEqual({
      error: 'PayloadTooLargeError',
      message: 'request entity too large',
    })
  })

  it('compresses large json responses', async () => {
    // first create a large record
    const record = {
      text: 'blahblabh',
      createdAt: new Date().toISOString(),
    }
    for (let i = 0; i < 100; i++) {
      record[randomStr(8, 'base32')] = randomStr(32, 'base32')
    }
    const createRes = await agent.com.atproto.repo.createRecord(
      {
        repo: alice,
        collection: 'app.bsky.feed.post',
        record,
      },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
    const uri = new AtUri(createRes.data.uri)

    const res = await request(
      `${network.pds.url}/xrpc/com.atproto.repo.getRecord?repo=${uri.host}&collection=${uri.collection}&rkey=${uri.rkey}`,
      {
        headers: { ...sc.getHeaders(alice), 'accept-encoding': 'gzip' },
      },
    )

    await finished(res.body.resume())

    expect(res.headers['content-encoding']).toEqual('gzip')
  })

  it('compresses large car file responses', async () => {
    const res = await request(
      `${network.pds.url}/xrpc/com.atproto.sync.getRepo?did=${alice}`,
      { headers: { 'accept-encoding': 'gzip' } },
    )

    await finished(res.body.resume())

    expect(res.headers['content-encoding']).toEqual('gzip')
  })

  it('does not compress small payloads', async () => {
    const res = await request(`${network.pds.url}/xrpc/_health`, {
      headers: { 'accept-encoding': 'gzip' },
    })

    await finished(res.body.resume())

    expect(res.headers['content-encoding']).toBeUndefined()
  })

  it('healthcheck succeeds when database is available.', async () => {
    const res = await fetch(`${network.pds.url}/xrpc/_health`)
    expect(res.status).toEqual(200)
    await expect(res.json()).resolves.toEqual({ version: '0.0.0' })
  })

  // @TODO this is hanging for some unknown reason
  it.skip('healthcheck fails when database is unavailable.', async () => {
    await network.pds.ctx.accountManager.db.close()

    const response = await fetch(`${network.pds.url}/xrpc/_health`)
    expect(response.status).toEqual(503)
    await expect(response.json()).resolves.toEqual({
      version: 'unknown',
      error: 'Service Unavailable',
    })
  })
})
