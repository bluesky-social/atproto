import * as http from 'http'
import { AddressInfo } from 'net'
import * as uint8arrays from 'uint8arrays'
import axios, { AxiosInstance } from 'axios'
import { getInfo } from '../../src/image/sharp'
import {
  BlobDiskCache,
  BlobDiskStorage,
  ImageProcessingServer,
} from '../../src/image/server'

describe('image processing server', () => {
  let server: ImageProcessingServer
  let httpServer: http.Server
  let client: AxiosInstance

  beforeAll(() => {
    const b64Bytes = (b64: string) => uint8arrays.fromString(b64, 'base64')
    const salt = b64Bytes('ndBCIfV1W85fVfR0ZMJ+Hg==')
    const key = b64Bytes('8j7NFCg1Al9Cw9ss8l3YE5VsF4OSdgJWIR+dMV+KtNg=')
    const storage = new BlobDiskStorage(`${__dirname}/fixtures`)
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
    if (server) await server.cache.clear()
  })

  it('processes image from storage.', async () => {
    const res = await client.get(
      server.uriBuilder.getSignedPath({
        fileId: 'key-landscape-small.jpg',
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
        size: 14605,
      }),
    )
    expect(res.headers).toEqual(
      expect.objectContaining({
        'content-type': 'image/jpeg',
        'cache-control': 'public, max-age=31536000',
        'content-length': '14605',
      }),
    )
  })

  it('caches results.', async () => {
    const path = server.uriBuilder.getSignedPath({
      fileId: 'key-landscape-small.jpg',
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
      fileId: 'key-landscape-small.jpg',
      format: 'jpeg',
      fit: 'cover',
      width: 500,
      height: 500,
      min: true,
    })
    expect(path).toEqual(
      '/anzVzkZ7zMwD0Hrz5pwa5imHXis1ayKbWwgBgKvgjkM/rs:fill:500:500:1:0/plain/key-landscape-small.jpg@jpeg',
    )
    const res = await client.get(path.replace('/a', '/bad_'), {})
    expect(res.status).toEqual(400)
    expect(res.data).toEqual({ message: 'Invalid path: bad signature' })
  })

  it('errors on missing file.', async () => {
    const res = await client.get(
      server.uriBuilder.getSignedPath({
        fileId: 'missing-file.jpg',
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
