import { AddressInfo } from 'net'
import express from 'express'
import axios, { AxiosError } from 'axios'
import { CloseFn, runTestServer, TestServerInfo } from './_util'
import { handler as errorHandler } from '../src/error'

describe('server', () => {
  let server: TestServerInfo
  let close: CloseFn

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'server',
    })
    close = server.close
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
        message: 'Internal Server Error',
      })
    }
  })
})
