import { Readable } from 'node:stream'
import { CID } from 'multiformats/cid'
import { cidForCbor } from '@atproto/common'
import { TestNetwork, basicSeed } from '@atproto/dev-env'
import { getInfo } from '../../src/image/sharp'
import { ImageUriBuilder } from '../../src/image/uri'

describe('image processing server', () => {
  let network: TestNetwork
  let fileDid: string
  let fileCid: CID

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_image_processing_server',
    })
    const sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
    fileDid = sc.dids.carol
    fileCid = sc.posts[fileDid][0].images[0].image.ref
  })

  afterAll(async () => {
    await network.close()
  })

  it('processes image from blob resolver.', async () => {
    const res = await fetch(
      new URL(
        `/img${ImageUriBuilder.getPath({
          preset: 'feed_fullsize',
          did: fileDid,
          cid: fileCid.toString(),
        })}`,
        network.bsky.url,
      ),
    )

    const bytes = new Uint8Array(await res.arrayBuffer())
    const info = await getInfo(Readable.from([bytes]))

    expect(info).toEqual({
      height: 580,
      width: 1000,
      size: 127578,
      mime: 'image/jpeg',
    })
    expect(Object.fromEntries(res.headers)).toEqual(
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
      cid: fileCid.toString(),
    })
    const url = new URL(`/img${path}`, network.bsky.url)

    const res1 = await fetch(url)
    expect(res1.headers.get('x-cache')).toEqual('miss')
    const bytes1 = new Uint8Array(await res1.arrayBuffer())
    const res2 = await fetch(url)
    expect(res2.headers.get('x-cache')).toEqual('hit')
    const bytes2 = new Uint8Array(await res2.arrayBuffer())
    const res3 = await fetch(url)
    expect(res3.headers.get('x-cache')).toEqual('hit')
    const bytes3 = new Uint8Array(await res3.arrayBuffer())
    expect(Buffer.compare(bytes1, bytes2)).toEqual(0)
    expect(Buffer.compare(bytes1, bytes3)).toEqual(0)
  })

  it('errors on missing file.', async () => {
    const missingCid = await cidForCbor('missing-file')

    const path = ImageUriBuilder.getPath({
      preset: 'feed_fullsize',
      did: fileDid,
      cid: missingCid.toString(),
    })

    const url = new URL(`/img${path}`, network.bsky.url)

    const res = await fetch(url)
    expect(res.status).toEqual(404)
    await expect(res.json()).resolves.toMatchObject({
      message: 'Blob not found',
    })
  })
})
