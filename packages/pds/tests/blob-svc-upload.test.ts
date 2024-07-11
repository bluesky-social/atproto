import AtpAgent from '@atproto/api'
import { SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import { sha256RawToCid } from '@atproto/common'
import { users } from './seeds/users'
import { ActorDb } from '../src/actor-store/db'
import http from 'http'
import { AddressInfo } from 'net'
import crypto from 'crypto'
import express from 'express'
import bodyParser from 'body-parser'
import { once } from 'events'
import fs from 'fs/promises'

describe('file uploads', () => {
  let network: TestNetworkNoAppView
  let blobSvcServer: http.Server
  let aliceDb: ActorDb
  let alice: string
  let agent: AtpAgent
  let sc: SeedClient
  let smallFile: Uint8Array
  const blobSvcStorage: BlobServiceStorage = {}

  beforeAll(async () => {
    blobSvcServer = await createMockBlobUploadService(blobSvcStorage)
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'file_uploads',
      pds: {
        blobServiceUrl: `http://localhost:${(blobSvcServer.address() as AddressInfo).port}`,
      },
    })
    // @ts-expect-error Error due to circular dependency with the dev-env package
    ctx = network.pds.ctx
    agent = network.pds.getClient()
    sc = network.getSeedClient()
    await sc.createAccount('alice', users.alice)
    await sc.createAccount('bob', users.bob)
    alice = sc.dids.alice
    aliceDb = await network.pds.ctx.actorStore.openDb(alice)
  })

  afterAll(async () => {
    aliceDb.close()
    await network.close()
    await blobSvcServer.close()
    once(blobSvcServer, 'close')
  })

  it('generates a blob upload url ', async () => {
    const response = await agent.com.atproto.repo.prepareBlobUploadUrl(
      {
        mimetype: 'application/json',
        size: 1000,
        collection: 'app.bsky.feed.post',
      },
      {
        headers: sc.getHeaders(alice),
        encoding: 'application/json',
      },
    )
    const { uploadId, url } = response.data
    expect(url).toBeDefined()
    expect(uploadId).toBeDefined()
  })

  it('finalizes correct blob upload', async () => {
    const response = await agent.com.atproto.repo.prepareBlobUploadUrl(
      {
        mimetype: 'application/json',
        size: 1000,
        collection: 'app.bsky.feed.post',
      },
      {
        headers: sc.getHeaders(alice),
        encoding: 'application/json',
      },
    )
    const { uploadId, url } = response.data
    smallFile = await fs.readFile(
      '../dev-env/src/seed/img/key-portrait-small.jpg',
    )
    const uploadResponse = await fetch(url, {
      method: 'POST',
      body: smallFile,
      headers: {
        'Content-Type': 'image/jpeg',
      },
    })
    const uploadBody = await uploadResponse.json()
    expect((uploadBody as any).blobRef).toBeDefined()

    const finalizeResponse = await agent.com.atproto.repo.finalizeBlobUpload(
      {
        blob: (uploadBody as any).blobRef,
        uploadId,
      },
      {
        headers: sc.getHeaders(alice),
        encoding: 'application/json',
      },
    )
    expect(finalizeResponse.data).toEqual({})
  })
})

interface BlobServiceStorage {
  [key: string]: {
    buf: Buffer
    ref: any
  }
}
async function createMockBlobUploadService(storage: BlobServiceStorage) {
  const app = express()
  const server = app.listen()

  app.get('/upload/:uploadId', (req, res) => {
    const uploadId = req.params.uploadId
    const upload = storage[uploadId]
    if (!upload) {
      res.status(404).send({
        error: 'Upload not found',
      })
      return
    }
    res.send({
      blobRef: upload.ref,
    })
  })

  app.post('/presigned-url', (req, res) => {
    const uploadId = crypto.randomUUID()
    const url = `http://localhost:${(server.address() as AddressInfo).port}/upload/${uploadId}`
    res.send({ url, uploadId })
  })

  app.use(
    bodyParser.raw({
      inflate: true,
      type: () => true,
    }),
  )
  app.post('/upload/:uploadId', (req, res) => {
    try {
      const body = req.body
      const hash = crypto.createHash('sha256').update(body)
      const cid = sha256RawToCid(hash.digest())
      const uploadId = req.params.uploadId

      if (storage[uploadId]) {
        res.status(400).send({
          error: 'Upload already exists',
        })
        return
      }

      const blobRef = {
        $type: 'blob',
        ref: {
          $link: cid.toString(),
        },
        mimeType: req.headers['content-type'],
        size: Buffer.from(body).byteLength,
      }

      storage[uploadId] = {
        ref: blobRef,
        buf: Buffer.from(body),
      }

      res.send({
        blobRef,
      })
    } catch (err) {
      res.status(500).send({
        error: 'Failed to upload',
      })
    }
  })
  await once(server, 'listening')
  return server
}
