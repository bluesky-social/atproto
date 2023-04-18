import { AddressInfo } from 'net'
import express from 'express'
import axios, { AxiosError } from 'axios'
import { runTestEnv, TestEnvInfo } from '@atproto/dev-env'
import { handler as errorHandler } from '../src/error'
import { Database } from '../src'

describe('server', () => {
  let testEnv: TestEnvInfo
  let db: Database

  beforeAll(async () => {
    testEnv = await runTestEnv({
      dbPostgresSchema: 'server',
    })
    db = testEnv.bsky.ctx.db
  })

  afterAll(async () => {
    await testEnv.close()
  })

  it('preserves 404s.', async () => {
    const promise = axios.get(`${testEnv.bsky.url}/unknown`)
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
    const { data, status } = await axios.get(`${testEnv.bsky.url}/xrpc/_health`)
    expect(status).toEqual(200)
    expect(data).toEqual({ version: '0.0.0' })
  })

  // TODO(bsky) check on a different endpoint that accepts json, currently none.
  it.skip('limits size of json input.', async () => {
    let error: AxiosError
    try {
      await axios.post(
        `${testEnv.bsky.url}/xrpc/com.atproto.repo.createRecord`,
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

  it('healthcheck fails when database is unavailable.', async () => {
    await testEnv.bsky.sub.destroy()
    await db.close()
    let error: AxiosError
    try {
      await axios.get(`${testEnv.bsky.url}/xrpc/_health`)
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
