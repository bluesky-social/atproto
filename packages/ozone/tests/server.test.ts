import express from 'express'
import { TestNetwork, TestOzone } from '@atproto/dev-env'
import { handler as errorHandler } from '../src/error'
import { startServer } from './_util'

describe('server', () => {
  let network: TestNetwork
  let ozone: TestOzone

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_server',
    })
    ozone = network.ozone
  })

  afterAll(async () => {
    await network.close()
  })

  it('preserves 404s.', async () => {
    const response = await fetch(`${ozone.url}/unknown`)
    expect(response.status).toEqual(404)
  })

  it('error handler turns unknown errors into 500s.', async () => {
    const app = express()
      .get('/oops', () => {
        throw new Error('Oops!')
      })
      .use(errorHandler)

    const { origin, stop } = await startServer(app)
    try {
      const response = await fetch(new URL(`/oops`, origin))
      expect(response.status).toEqual(500)
      await expect(response.json()).resolves.toEqual({
        error: 'InternalServerError',
        message: 'Internal Server Error',
      })
    } finally {
      await stop()
    }
  })

  it('healthcheck succeeds when database is available.', async () => {
    const response = await fetch(`${network.bsky.url}/xrpc/_health`)
    expect(response.status).toEqual(200)
    await expect(response.json()).resolves.toEqual({ version: 'unknown' })
  })

  it('healthcheck fails when database is unavailable.', async () => {
    // destroy sequencer to release connection that would prevent the db from closing
    await ozone.ctx.sequencer.destroy()
    await ozone.ctx.db.close()

    const res = await fetch(`${ozone.url}/xrpc/_health`)

    expect(res.status).toEqual(503)
    await expect(res.json()).resolves.toEqual({
      version: '0.0.0',
      error: 'Service Unavailable',
    })
  })
})
