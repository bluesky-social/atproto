import { CloseFn, runTestServer, TestServerInfo } from './_util'
import axios, { AxiosError } from 'axios'

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

  it('turns unknown errors into 500s.', async () => {
    // Sneak a new, failing route in before the server's error handler
    const errorHandler = server.app._router.stack.pop()
    server.app.get('/oops', () => {
      throw new Error('Oops!')
    })
    server.app._router.stack.push(errorHandler)

    const promise = axios.get(`${server.url}/oops`)
    await expect(promise).rejects.toThrow('failed with status code 500')
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
