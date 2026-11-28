import { once } from 'node:events'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import express from 'express'
import { describe, expect, it } from 'vitest'
import { handler } from './error.js'

describe('error handler', () => {
  it('turns unknown errors into 500s', async () => {
    const app = express()
    app.get('/oops', () => {
      throw new Error('Oops!')
    })
    app.use(handler)
    await using server = createServer(app)
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const { port } = server.address() as AddressInfo

    const response = await fetch(`http://127.0.0.1:${port}/oops`)
    expect(response.status).toEqual(500)
    await expect(response.json()).resolves.toEqual({
      error: 'InternalServerError',
      message: 'Internal Server Error',
    })
  })
})
