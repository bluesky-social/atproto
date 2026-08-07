import express from 'express'
import { IdResolver } from '@atproto/identity'
import {
  StreamUidMismatchError,
  VideoJobService,
} from '@atproto/video-processing'
import { AuthVerifier } from '../../src/auth-verifier'
import { AppContext } from '../../src/context'
import { createVideoRouter } from '../../src/video/routes'

describe('video routes', () => {
  const did = 'did:plc:alice'
  const videoCid = 'bafkreibm6jg3ux5qux2m7g5w4hfuaf2mp4xg6t4n2v5x6iiys5ndq4nohq'
  const cdnUrl = 'https://media.example'
  let app: express.Express
  let submit: jest.Mock
  let markReadyFromWebhook: jest.Mock
  let deleteJob: jest.Mock

  beforeEach(() => {
    submit = jest.fn(async (input: { did: string; videoCid: string }) => ({
      did: input.did,
      videoCid: input.videoCid,
      state: 'processing' as const,
      streamUid: 'stream-uid-1',
      attempts: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
    }))
    markReadyFromWebhook = jest.fn(async () => ({
      did,
      videoCid,
      state: 'ready' as const,
      streamUid: 'stream-uid-1',
      playlistUrl: 'https://stream.example/stream-uid-1/manifest/video.m3u8',
      attempts: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
    }))
    deleteJob = jest.fn(async () => ({
      did,
      videoCid,
      state: 'failed' as const,
      error: 'ModerationBlocked' as const,
      attempts: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
    }))

    const service = {
      submit,
      markReadyFromWebhook,
      delete: deleteJob,
    } as unknown as VideoJobService

    const authVerifier = new AuthVerifier({} as IdResolver, {
      ownDid: 'did:web:appview',
      alternateAudienceDids: [],
      adminPasswords: ['admin-secret'],
    })
    const ctx = {
      authVerifier,
      cfg: { cdnUrl },
    } as unknown as AppContext

    app = express()
    app.use(express.json())
    app.use(
      '/_sokaa/video',
      createVideoRouter({
        ctx,
        db: {} as never,
        service,
      }),
    )
  })

  afterEach(() => {
    delete process.env.SOKAA_STREAM_WEBHOOK_SECRET
  })

  it('rejects job submit without admin basic auth', async () => {
    const res = await fetchApp('POST', '/_sokaa/video/jobs', {
      body: { did, videoCid },
    })
    expect(res.status).toBe(401)
  })

  it('rejects off-origin sourceUrl', async () => {
    const res = await fetchApp('POST', '/_sokaa/video/jobs', {
      auth: basic('admin', 'admin-secret'),
      body: {
        did,
        videoCid,
        sourceUrl: 'https://evil.example/v1/media/a/b',
      },
    })
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('sourceUrl must be a media-gateway')
    expect(submit).not.toHaveBeenCalled()
  })

  it('submits jobs with admin auth and default sourceUrl', async () => {
    const res = await fetchApp('POST', '/_sokaa/video/jobs', {
      auth: basic('admin', 'admin-secret'),
      body: { did, videoCid },
    })
    expect(res.status).toBe(200)
    expect(submit).toHaveBeenCalledWith({
      did,
      videoCid,
      sourceUrl: `${cdnUrl}/v1/media/${encodeURIComponent(did)}/${videoCid}`,
    })
  })

  it('requires webhook secret and returns 409 on uid mismatch', async () => {
    process.env.SOKAA_STREAM_WEBHOOK_SECRET = 'hook-secret'
    markReadyFromWebhook.mockRejectedValueOnce(new StreamUidMismatchError())

    const unauthorized = await fetchApp(
      'POST',
      '/_sokaa/video/webhooks/stream',
      {
        body: { did, videoCid, uid: 'other' },
      },
    )
    expect(unauthorized.status).toBe(401)

    const conflict = await fetchApp('POST', '/_sokaa/video/webhooks/stream', {
      headers: { 'X-Sokaa-Webhook-Secret': 'hook-secret' },
      body: { did, videoCid, uid: 'other' },
    })
    expect(conflict.status).toBe(409)
  })

  it('deletes jobs with admin auth', async () => {
    const res = await fetchApp(
      'DELETE',
      `/_sokaa/video/jobs/${encodeURIComponent(did)}/${videoCid}`,
      { auth: basic('admin', 'admin-secret') },
    )
    expect(res.status).toBe(200)
    expect(deleteJob).toHaveBeenCalledWith(did, videoCid)
  })

  async function fetchApp(
    method: string,
    path: string,
    opts: {
      auth?: string
      headers?: Record<string, string>
      body?: unknown
    } = {},
  ) {
    const server = app.listen(0)
    const { port } = server.address() as { port: number }
    try {
      return await fetch(`http://127.0.0.1:${port}${path}`, {
        method,
        headers: {
          ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
          ...(opts.auth ? { Authorization: opts.auth } : {}),
          ...opts.headers,
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      })
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()))
      })
    }
  }
})

function basic(user: string, password: string) {
  return `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`
}
