import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TestNetwork, type TestOzone } from '@atproto/dev-env'

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
    await network?.close()
  })

  it('preserves 404s.', async () => {
    const response = await fetch(`${ozone.url}/unknown`)
    expect(response.status).toEqual(404)
  })

  it('healthcheck succeeds when database is available.', async () => {
    const response = await fetch(`${ozone.url}/xrpc/_health`)
    expect(response.status).toEqual(200)
    await expect(response.json()).resolves.toEqual({ version: '0.0.0' })
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
