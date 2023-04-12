import axios, { AxiosInstance } from 'axios'
import { CID } from 'multiformats/cid'
import { AtpAgent } from '@atproto/api'
import { cidForCbor } from '@atproto/common'
import { runTestEnv, TestEnvInfo } from '@atproto/dev-env'
import { getInfo } from '../../src/image/sharp'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { processAll } from '../_util'

describe('image processing server', () => {
  let testEnv: TestEnvInfo
  let client: AxiosInstance
  let fileDid: string
  let fileCid: CID

  beforeAll(async () => {
    testEnv = await runTestEnv({
      dbPostgresSchema: 'image_processing_server',
      bsky: {
        imgUriKey:
          'f23ecd142835025f42c3db2cf25dd813956c178392760256211f9d315f8ab4d8',
        imgUriSalt: '9dd04221f5755bce5f55f47464c27e1e',
      },
    })
    const pdsAgent = new AtpAgent({ service: testEnv.pds.url })
    const sc = new SeedClient(pdsAgent)
    await basicSeed(sc)
    await processAll(testEnv)
    fileDid = sc.dids.carol
    fileCid = sc.posts[fileDid][0].images[0].image.ref
    client = axios.create({
      baseURL: `${testEnv.bsky.url}/image`,
      validateStatus: () => true,
    })
  })

  afterAll(async () => {
    await testEnv.close()
  })

  it('processes image from blob resolver.', async () => {
    const res = await client.get(
      testEnv.bsky.ctx.imgUriBuilder.getSignedPath({
        did: fileDid,
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
    const path = testEnv.bsky.ctx.imgUriBuilder.getSignedPath({
      did: fileDid,
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
    const path = testEnv.bsky.ctx.imgUriBuilder.getSignedPath({
      did: fileDid,
      cid: fileCid,
      format: 'jpeg',
      fit: 'cover',
      width: 500,
      height: 500,
      min: true,
    })
    const res = await client.get(path.replace('/', '/_'), {})
    expect(res.status).toEqual(400)
    expect(res.data).toEqual({ message: 'Invalid path: bad signature' })
  })

  it('errors on missing file.', async () => {
    const missingCid = await cidForCbor('missing-file')
    const res = await client.get(
      testEnv.bsky.ctx.imgUriBuilder.getSignedPath({
        did: fileDid,
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
