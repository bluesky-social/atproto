import { AddressInfo } from 'net'
import express from 'express'
import axios, { AxiosError } from 'axios'
import AtpAgent from '@atproto/api'
import { CloseFn, runTestServer, TestServerInfo } from './_util'
import { handler as errorHandler } from '../src/error'
import { SeedClient } from './seeds/client'
import basicSeed from './seeds/basic'
import { Database } from '../src'

describe('server', () => {
  let server: TestServerInfo
  let close: CloseFn
  let db: Database
  let agent: AtpAgent
  let sc: SeedClient
  let alice: string

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'server',
    })
    close = server.close
    db = server.ctx.db
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await basicSeed(sc)
    alice = sc.dids.alice
  })

  afterAll(async () => {
    await close()
  })

  it('preserves 404s.', async () => {
    const promise = axios.get(`${server.url}/unknown`)
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

  it('limits size of json input.', async () => {
    let error: AxiosError
    try {
      await axios.post(
        `${server.url}/xrpc/com.atproto.repo.createRecord`,
        {
          data: 'x'.repeat(100 * 1024), // 100kb
        },
        { headers: sc.getHeaders(alice) },
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
      `${server.url}/xrpc/app.bsky.feed.getTimeline`,
      {
        decompress: false,
        headers: { ...sc.getHeaders(alice), 'accept-encoding': 'gzip' },
      },
    )
    expect(res.headers['content-encoding']).toEqual('gzip')
  })

  it('compresses large car file responses', async () => {
    const res = await axios.get(
      `${server.url}/xrpc/com.atproto.sync.getRepo?did=${alice}`,
      { decompress: false, headers: { 'accept-encoding': 'gzip' } },
    )
    expect(res.headers['content-encoding']).toEqual('gzip')
  })

  it('does not compress small payloads', async () => {
    const res = await axios.get(`${server.url}/xrpc/_health`, {
      decompress: false,
      headers: { 'accept-encoding': 'gzip' },
    })
    expect(res.headers['content-encoding']).toBeUndefined()
  })

  it('healthcheck succeeds when database is available.', async () => {
    const { data, status } = await axios.get(`${server.url}/xrpc/_health`)
    expect(status).toEqual(200)
    expect(data).toEqual({ version: '0.0.0' })
  })

  it('healthcheck fails when database is unavailable.', async () => {
    // destroy to release lock & allow db to close
    await server.ctx.sequencerLeader.destroy()

    await db.close()
    let error: AxiosError
    try {
      await axios.get(`${server.url}/xrpc/_health`)
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
