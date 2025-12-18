import { AddressInfo } from 'node:net'
import { HttpServer, startServer } from './nodejs.js'

describe('Node.js RequestListener', () => {
  let server: HttpServer
  let address: string

  beforeAll(async () => {
    server = await startServer(async (request) => {
      const { pathname } = new URL(request.url)
      if (pathname === '/hello') {
        return new Response('Hello, world!', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        })
      }
      return new Response('Not Found', { status: 404 })
    })
    const { port } = server.address() as AddressInfo
    address = `http://localhost:${port}`
  })

  afterAll(async () => {
    server.close()
  })

  it('should respond with Hello, world! on /hello', async () => {
    const res = await fetch(`${address}/hello`)
    const text = await res.text()
    expect(res.status).toBe(200)
    expect(text).toBe('Hello, world!')
  })

  it('should respond with Not Found on unknown path', async () => {
    const res = await fetch(`${address}/unknown`)
    const text = await res.text()
    expect(res.status).toBe(404)
    expect(text).toBe('Not Found')
  })
})
