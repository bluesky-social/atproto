import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { jest } from '@jest/globals'
import { CID } from 'multiformats/cid'
import * as Digest from 'multiformats/hashes/digest'
import * as undici from 'undici'
import { envToCfg } from '../src/config/config.js'
import { readEnv } from '../src/config/env.js'
import { BlobDiverter } from '../src/daemon/blob-diverter.js'

it('diverts a large blob and does not repeat an upload after a response timeout', async () => {
  const received: {
    size: number
    hash: string
    url?: string
    auth?: string
  }[] = []
  const server = createServer((req, res) => {
    let size = 0
    const hash = createHash('sha256')
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      hash.update(chunk)
    })
    req.on('end', () => {
      received.push({
        size,
        hash: hash.digest('hex'),
        url: req.url,
        auth: req.headers.authorization,
      })
      res.writeHead(200).end()
    })
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')

  try {
    const serviceUrl =
      `http://127.0.0.1:${(server.address() as AddressInfo).port}` as const
    jest.replaceProperty(process, 'env', {
      OZONE_BLOB_DIVERT_MAX_BYTES: String(101 * 1024 * 1024),
    })
    const config = envToCfg({
      ...readEnv(),
      publicUrl: 'https://ozone.example.com',
      serverDid: 'did:plc:ozone',
      dbPostgresUrl: 'postgresql://localhost/ozone',
      appviewUrl: 'https://appview.example.com',
      appviewDid: 'did:plc:appview',
      didPlcUrl: 'https://plc.example.com',
      blobDivertUrl: serviceUrl,
      blobDivertAdminPassword: 'password',
    }).blobDivert!
    const chunk = Buffer.alloc(1024 * 1024, 0x61)
    const hash = createHash('sha256')
    for (let i = 0; i < 101; i++) hash.update(chunk)
    const digest = hash.digest()
    const cid = CID.createV1(0x55, Digest.create(0x12, digest)).toString()
    using fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => {
        let remaining = 101
        return new Response(
          new ReadableStream({
            pull(controller) {
              if (remaining-- > 0) controller.enqueue(chunk)
              else controller.close()
            },
          }),
          {
            headers: {
              'content-type': 'video/mp4',
              'content-length': String(101 * chunk.length),
            },
          },
        )
      })
    const diverter = new BlobDiverter(null as never, {
      idResolver: {
        did: {
          resolve: async () => ({
            id: 'did:plc:example',
            service: [
              {
                id: '#atproto_pds',
                type: 'AtprotoPersonalDataServer',
                serviceEndpoint: 'https://api.bsky.app',
              },
            ],
          }),
        },
      } as never,
      serviceConfig: config,
    })
    await diverter.uploadBlobOnService({
      subjectDid: 'did:plc:example',
      subjectUri: null,
      subjectBlobCids: [cid],
    })
    expect(received).toEqual([
      {
        size: 101 * chunk.length,
        hash: digest.toString('hex'),
        url: '/xrpc/com.atproto.unspecced.reportBlob?did=did%3Aplc%3Aexample',
        auth: `Basic ${Buffer.from('admin:password').toString('base64')}`,
      },
    ])

    const smallBlob = Buffer.from('blob')
    const smallCid = CID.createV1(
      0x55,
      Digest.create(0x12, createHash('sha256').update(smallBlob).digest()),
    ).toString()
    fetch.mockImplementation(
      async () =>
        new Response(smallBlob, {
          headers: { 'content-length': String(101 * chunk.length + 1) },
        }),
    )
    await expect(
      diverter.uploadBlobOnService({
        subjectDid: 'did:plc:example',
        subjectUri: null,
        subjectBlobCids: [smallCid],
      }),
    ).rejects.toThrow('Failed to process blobs')
    expect(received).toHaveLength(1)

    const dispatcher = undici.getGlobalDispatcher()
    const agent = new undici.MockAgent()
    agent.disableNetConnect()
    undici.setGlobalDispatcher(agent)
    try {
      const timeout = new undici.errors.HeadersTimeoutError()
      agent
        .get(serviceUrl)
        .intercept({ path: /reportBlob/, method: 'POST' })
        .replyWithError(timeout)
        .persist()
      fetch.mockResolvedValue(new Response(smallBlob))
      fetch.mockClear()
      await expect(
        diverter.uploadBlobOnService({
          subjectDid: 'did:plc:example',
          subjectUri: null,
          subjectBlobCids: [smallCid],
        }),
      ).rejects.toMatchObject({ statusCode: 502, cause: { cause: timeout } })
      expect(fetch).toHaveBeenCalledTimes(1)
    } finally {
      undici.setGlobalDispatcher(dispatcher)
      await agent.close()
    }
  } finally {
    jest.restoreAllMocks()
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    )
  }
})
