import { once } from 'node:events'
import http from 'node:http'
import { AddressInfo } from 'node:net'
import express from 'express'
import { TestNetworkNoAppView } from '@atproto/dev-env'

type Captured = {
  method: string
  url: string
  auth: string | undefined
  body: string
}

class SokaaAdminMock {
  constructor(
    public server: http.Server,
    public url: string,
    public did: string,
    public requests: Captured[],
  ) {}

  static async create(did: string): Promise<SokaaAdminMock> {
    const requests: Captured[] = []
    const app = express()
    app.use(express.json())
    app.all('/_sokaa/*', (req, res) => {
      requests.push({
        method: req.method,
        url: req.originalUrl,
        auth: req.headers.authorization,
        body: JSON.stringify(req.body ?? {}),
      })
      res.status(200).json({ ok: true, path: req.originalUrl })
    })

    const server = app.listen(0)
    await once(server, 'listening')
    const { port } = server.address() as AddressInfo
    return new SokaaAdminMock(server, `http://127.0.0.1:${port}`, did, requests)
  }

  async close() {
    await new Promise<void>((resolve, reject) => {
      this.server.close((err) => (err ? reject(err) : resolve()))
    })
  }
}

describe('sokaa admin path proxy', () => {
  let network: TestNetworkNoAppView
  let appview: SokaaAdminMock

  beforeAll(async () => {
    appview = await SokaaAdminMock.create('did:web:sokaa.appview.admin.test')
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'sokaa_admin_proxy',
      pds: {
        sokaaAppViewUrl: appview.url,
        sokaaAppViewDid: appview.did,
      },
    })
  })

  afterAll(async () => {
    await appview?.close()
    await network?.close()
  })

  it('proxies POST /_sokaa/video/jobs to the Sokaa AppView', async () => {
    const auth = 'Basic ' + Buffer.from('admin:admin-pass').toString('base64')
    const res = await fetch(`${network.pds.url}/_sokaa/video/jobs`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        did: 'did:plc:smoke',
        videoCid: 'bafytest',
      }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(appview.requests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: 'POST',
          url: '/_sokaa/video/jobs',
          auth,
        }),
      ]),
    )
  })

  it('proxies DELETE /_sokaa/video/jobs/:did/:cid', async () => {
    const auth = 'Basic ' + Buffer.from('admin:admin-pass').toString('base64')
    const did = encodeURIComponent('did:plc:smoke')
    const cid = encodeURIComponent('bafytest')
    const res = await fetch(
      `${network.pds.url}/_sokaa/video/jobs/${did}/${cid}`,
      {
        method: 'DELETE',
        headers: { Authorization: auth },
      },
    )
    expect(res.status).toBe(200)
    expect(appview.requests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: 'DELETE',
          url: `/_sokaa/video/jobs/${did}/${cid}`,
        }),
      ]),
    )
  })

  it('returns 404 for /_sokaa when Sokaa AppView is not configured', async () => {
    const bare = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'sokaa_admin_proxy_none',
    })
    try {
      const res = await fetch(`${bare.pds.url}/_sokaa/video/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      expect(res.status).toBe(404)
    } finally {
      await bare.close()
    }
  })
})
