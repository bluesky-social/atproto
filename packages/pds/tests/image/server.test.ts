import * as http from 'http'
import os from 'os'
import path from 'path'
import fs from 'fs'
import { AddressInfo } from 'net'
import axios, { AxiosInstance } from 'axios'
import { getInfo } from '../../src/image/sharp'
import { BlobDiskCache, ImageProcessingServer } from '../../src/image/server'
import { DiskBlobStore } from '../../src'
import { cidForCbor } from '@atproto/common'
import { CID } from 'multiformats/cid'

describe('image processing server', () => {
  let server: ImageProcessingServer
  let httpServer: http.Server
  let client: AxiosInstance

  let fileCid: CID

  beforeAll(async () => {
    const salt = '9dd04221f5755bce5f55f47464c27e1e'
    const key =
      'f23ecd142835025f42c3db2cf25dd813956c178392760256211f9d315f8ab4d8'
    const storage = await DiskBlobStore.create(
      path.join(os.tmpdir(), 'img-processing-tests'),
    )
    // this CID isn't accurate for the data, but it works for the sake of the test
    fileCid = await cidForCbor('key-landscape-small')
    await storage.putPermanent(
      fileCid,
      fs.createReadStream('tests/image/fixtures/key-landscape-small.jpg'),
    )
    const cache = new BlobDiskCache()
    server = new ImageProcessingServer(salt, key, storage, cache)
    httpServer = server.app.listen()
    const { port } = httpServer.address() as AddressInfo
    client = axios.create({
      baseURL: `http://localhost:${port}`,
      validateStatus: () => true,
    })
  })

  afterAll(async () => {
    if (httpServer) httpServer.close()
    if (server) await server.cache.clearAll()
  })

  it('processes image from storage.', async () => {
    const res = await client.get(
      server.uriBuilder.getSignedPath({
        cid: fileCid,
        format: 'jpeg',
        fit: 'cover',
        width: 500,
        height: 500,
        min: true,
      }),
      { responseType: 'stream' },
    )

    const info = await getInfo(res.data)
    expect(info).toEqual(
      expect.objectContaining({
        height: 500,
        width: 500,
        size: 67221,
      }),
    )
    expect(res.headers).toEqual(
      expect.objectContaining({
        'content-type': 'image/jpeg',
        'cache-control': 'public, max-age=31536000',
        'content-length': '67221',
      }),
    )
  })

  it('caches results.', async () => {
    const path = server.uriBuilder.getSignedPath({
      cid: fileCid,
      format: 'jpeg',
      width: 25, // Special number for this test
      height: 25,
    })
    const res1 = await client.get(path, { responseType: 'arraybuffer' })
    expect(res1.headers['x-cache']).toEqual('miss')
    const res2 = await client.get(path, { responseType: 'arraybuffer' })
    expect(res2.headers['x-cache']).toEqual('hit')
    const res3 = await client.get(path, { responseType: 'arraybuffer' })
    expect(res3.headers['x-cache']).toEqual('hit')
    expect(Buffer.compare(res1.data, res2.data)).toEqual(0)
    expect(Buffer.compare(res1.data, res3.data)).toEqual(0)
  })

  it('errors on bad signature.', async () => {
    const path = server.uriBuilder.getSignedPath({
      cid: fileCid,
      format: 'jpeg',
      fit: 'cover',
      width: 500,
      height: 500,
      min: true,
    })
    expect(path).toEqual(
      `/G37yf764s6331dxOWiaOYEiLdg8OJxeE-RNxPDKB9Ck/rs:fill:500:500:1:0/plain/${fileCid.toString()}@jpeg`,
    )
    const res = await client.get(path.replace('/G', '/bad_'), {})
    expect(res.status).toEqual(400)
    expect(res.data).toEqual({ message: 'Invalid path: bad signature' })
  })

  it('errors on missing file.', async () => {
    const missingCid = await cidForCbor('missing-file')
    const res = await client.get(
      server.uriBuilder.getSignedPath({
        cid: missingCid,
        format: 'jpeg',
        fit: 'cover',
        width: 500,
        height: 500,
        min: true,
      }),
    )
    expect(res.status).toEqual(404)
    expect(res.data).toEqual({ message: 'Image not found' })
  })
})
