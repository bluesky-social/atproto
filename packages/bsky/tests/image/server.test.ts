import axios, { AxiosInstance } from 'axios'
import { CID } from 'multiformats/cid'
import { cidForCbor } from '@atproto/common'
import { TestNetwork, basicSeed } from '@atproto/dev-env'
import { getInfo } from '../../src/image/sharp'
import { ImageUriBuilder } from '../../src/image/uri'

describe('image processing server', () => {
  let network: TestNetwork
  let client: AxiosInstance
  let fileDid: string
  let fileCid: CID

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_image_processing_server',
    })
    const sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
    await network.bsky.processAll()
    fileDid = sc.dids.carol
    fileCid = sc.posts[fileDid][0].images[0].image.ref
    client = axios.create({
      baseURL: `${network.bsky.url}/img`,
      validateStatus: () => true,
    })
  })

  afterAll(async () => {
    await network.close()
  })

  it('processes image from blob resolver.', async () => {
    const res = await client.get(
      ImageUriBuilder.getPath({
        preset: 'feed_fullsize',
        did: fileDid,
        cid: fileCid,
      }),
      { responseType: 'stream' },
    )

    const info = await getInfo(res.data)

    expect(info).toEqual({
      height: 580,
      width: 1000,
      size: 127578,
      mime: 'image/jpeg',
    })
    expect(res.headers).toEqual(
      expect.objectContaining({
        'content-type': 'image/jpeg',
        'cache-control': 'public, max-age=31536000',
        'content-length': '127578',
      }),
    )
  })

  it('caches results.', async () => {
    const path = ImageUriBuilder.getPath({
      preset: 'avatar',
      did: fileDid,
      cid: fileCid,
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

  it('errors on missing file.', async () => {
    const missingCid = await cidForCbor('missing-file')
    const res = await client.get(
      ImageUriBuilder.getPath({
        preset: 'feed_fullsize',
        did: fileDid,
        cid: missingCid,
      }),
    )
    expect(res.status).toEqual(404)
    expect(res.data).toEqual({ message: 'Image not found' })
  })
})
