import { finished } from 'node:stream/promises'
import express from 'express'
import { request } from 'undici'
import { AtUri, AtpAgent } from '@atproto/api'
import { randomStr } from '@atproto/crypto'
import { SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import type { DidString } from '@atproto/syntax'
import { handler as errorHandler } from '../src/error.js'
import { startServer } from './_util.js'
import basicSeed from './seeds/basic.js'

describe('server', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient
  let alice: DidString

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'server',
      pds: {
        version: '0.0.0',
      },
    })
    agent = network.pds.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc)
    alice = sc.dids.alice
  })

  afterAll(async () => {
    await network?.close()
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

    await using server = await startServer(app)

    const res = await fetch(`http://localhost:${server.port}/oops`)
    expect(res.status).toEqual(500)
    await expect(res.json()).resolves.toEqual({
      error: 'InternalServerError',
      message: 'Internal Server Error',
    })
  })

  it('limits size of json input.', async () => {
    const res = await fetch(
      `${network.pds.url}/xrpc/com.atproto.identity.updateHandle`,
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

    const url = new URL(`/xrpc/com.atproto.repo.getRecord`, network.pds.url)
    url.searchParams.set('repo', uri.host)
    url.searchParams.set('collection', uri.collectionSafe)
    url.searchParams.set('rkey', uri.rkeySafe)

    const res = await request(url, {
      headers: { ...sc.getHeaders(alice), 'accept-encoding': 'gzip' },
    })

    await finished(res.body.resume())

    expect(res.headers['content-encoding']).toEqual('gzip')
  })

  it('compresses large car file responses', async () => {
    const url = new URL(`/xrpc/com.atproto.sync.getRepo`, network.pds.url)
    url.searchParams.set('did', alice)

    const res = await request(url, {
      headers: { 'accept-encoding': 'gzip' },
    })

    await finished(res.body.resume())

    expect(res.headers['content-encoding']).toEqual('gzip')
  })

  it('does not compress small payloads', async () => {
    const url = new URL(`/xrpc/_health`, network.pds.url)
    const res = await request(url, {
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
