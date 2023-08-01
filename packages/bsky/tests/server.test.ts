import { AddressInfo } from 'net'
import express from 'express'
import axios, { AxiosError } from 'axios'
import { TestNetwork } from '@atproto/dev-env'
import { handler as errorHandler } from '../src/error'
import { Database } from '../src'
import { SeedClient } from './seeds/client'
import basicSeed from './seeds/basic'

describe('server', () => {
  let network: TestNetwork
  let db: Database
  let alice: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_server',
    })
    const pdsAgent = network.pds.getClient()
    const sc = new SeedClient(pdsAgent)
    await basicSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
    db = network.bsky.ctx.db
  })

  afterAll(async () => {
    await network.close()
  })

  it('preserves 404s.', async () => {
    const promise = axios.get(`${network.bsky.url}/unknown`)
    await expect(promise).rejects.toThrow('failed with status code 404')
  })

  it('error handler turns unknown errors into 500s.', async () => {
    const app = express()
    app.get('/oops', () => {
      throw new Error('Oops!')
    })
    app.use(errorHandler)
    const srv = app.listen()
    const port = (srv.address() as AddressInfo).port
    const promise = axios.get(`http://localhost:${port}/oops`)
    await expect(promise).rejects.toThrow('failed with status code 500')
    srv.close()
    try {
      await promise
    } catch (err: unknown) {
      const axiosError = err as AxiosError
      expect(axiosError.response?.status).toEqual(500)
      expect(axiosError.response?.data).toEqual({
        error: 'InternalServerError',
        message: 'Internal Server Error',
      })
    }
  })

  it('healthcheck succeeds when database is available.', async () => {
    const { data, status } = await axios.get(`${network.bsky.url}/xrpc/_health`)
    expect(status).toEqual(200)
    expect(data).toEqual({ version: '0.0.0' })
  })

  // TODO(bsky) check on a different endpoint that accepts json, currently none.
  it.skip('limits size of json input.', async () => {
    let error: AxiosError
    try {
      await axios.post(
        `${network.bsky.url}/xrpc/com.atproto.repo.createRecord`,
        {
          data: 'x'.repeat(100 * 1024), // 100kb
        },
        // { headers: sc.getHeaders(alice) },
      )
      throw new Error('Request should have failed')
    } catch (err) {
      if (axios.isAxiosError(err)) {
        error = err
      } else {
        throw err
      }
    }
    expect(error.response?.status).toEqual(413)
    expect(error.response?.data).toEqual({
      error: 'PayloadTooLargeError',
      message: 'request entity too large',
    })
  })

  it('compresses large json responses', async () => {
    const res = await axios.get(
      `${network.bsky.url}/xrpc/app.bsky.feed.getTimeline`,
      {
        decompress: false,
        headers: {
          ...(await network.serviceHeaders(alice)),
          'accept-encoding': 'gzip',
        },
      },
    )
    expect(res.headers['content-encoding']).toEqual('gzip')
  })

  it('does not compress small payloads', async () => {
    const res = await axios.get(`${network.bsky.url}/xrpc/_health`, {
      decompress: false,
      headers: { 'accept-encoding': 'gzip' },
    })
    expect(res.headers['content-encoding']).toBeUndefined()
  })

  it('healthcheck fails when database is unavailable.', async () => {
    await network.bsky.ingester.sub.destroy()
    await network.bsky.indexer.sub.destroy()
    await db.close()
    let error: AxiosError
    try {
      await axios.get(`${network.bsky.url}/xrpc/_health`)
      throw new Error('Healthcheck should have failed')
    } catch (err) {
      if (axios.isAxiosError(err)) {
        error = err
      } else {
        throw err
      }
    }
    expect(error.response?.status).toEqual(503)
    expect(error.response?.data).toEqual({
      version: '0.0.0',
      error: 'Service Unavailable',
    })
  })
})
