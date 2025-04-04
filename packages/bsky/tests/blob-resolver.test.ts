import { CID } from 'multiformats/cid'
import { request } from 'undici'
import { cidForCbor, verifyCidForBytes } from '@atproto/common'
import { randomBytes } from '@atproto/crypto'
import { TestNetwork, basicSeed } from '@atproto/dev-env'

describe('blob resolver', () => {
  let network: TestNetwork
  let fileDid: string
  let fileCid: CID
  let fileSize: number

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_blob_resolver',
    })
    const sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
    fileDid = sc.dids.carol
    fileCid = sc.posts[fileDid][0].images[0].image.ref
    fileSize = sc.posts[fileDid][0].images[0].image.size
  })

  afterAll(async () => {
    await network.close()
  })

  it('resolves blob with good signature check.', async () => {
    const response = await request(
      new URL(`/blob/${fileDid}/${fileCid.toString()}`, network.bsky.url),
    )
    expect(response.statusCode).toEqual(200)
    expect(response.headers['content-type']).toEqual('image/jpeg')
    expect(response.headers['content-security-policy']).toEqual(
      `default-src 'none'; sandbox`,
    )
    expect(response.headers['x-content-type-options']).toEqual('nosniff')

    const bytes = new Uint8Array(await response.body.arrayBuffer())
    await expect(verifyCidForBytes(fileCid, bytes)).resolves.toBeUndefined()
  })

  it('404s on missing blob.', async () => {
    const badCid = await cidForCbor({ unknown: true })
    const response = await request(
      new URL(`/blob/${fileDid}/${badCid.toString()}`, network.bsky.url),
    )
    expect(response.statusCode).toEqual(404)
    await expect(response.body.json()).resolves.toEqual({
      error: 'NotFoundError',
      message: 'Blob not found',
    })
  })

  it('404s on missing identity.', async () => {
    const nonExistingDid = `did:plc:${'a'.repeat(24)}`

    const response = await request(
      new URL(
        `/blob/${nonExistingDid}/${fileCid.toString()}`,
        network.bsky.url,
      ),
    )
    expect(response.statusCode).toEqual(404)
    await expect(response.body.json()).resolves.toEqual({
      error: 'NotFoundError',
      message: 'Origin not found',
    })
  })

  it('400s on invalid did.', async () => {
    const response = await request(
      new URL(`/blob/did::/${fileCid.toString()}`, network.bsky.url),
    )
    expect(response.statusCode).toEqual(400)
    await expect(response.body.json()).resolves.toEqual({
      error: 'BadRequestError',
      message: 'Invalid did',
    })
  })

  it('400s on invalid cid.', async () => {
    const response = await request(
      new URL(`/blob/${fileDid}/barfy`, network.bsky.url),
    )
    expect(response.statusCode).toEqual(400)
    await expect(response.body.json()).resolves.toEqual({
      error: 'BadRequestError',
      message: 'Invalid cid',
    })
  })

  it('400s on missing file.', async () => {
    const missingCid = await cidForCbor('missing-file')

    const response = await request(
      new URL(`/blob/${fileDid}/${missingCid}`, network.bsky.url),
    )
    expect(response.statusCode).toEqual(404)
    await expect(response.body.json()).resolves.toEqual({
      error: 'NotFoundError',
      message: 'Blob not found',
    })
  })

  it('replaces the file with invalid bytes.', async () => {
    await network.pds.ctx.blobstore(fileDid).delete(fileCid)
    await network.pds.ctx
      .blobstore(fileDid)
      .putPermanent(fileCid, randomBytes(fileSize))
  })

  it('fails to fetch bytes on blob with bad signature check.', async () => {
    const response = await request(
      new URL(`/blob/${fileDid}/${fileCid.toString()}`, network.bsky.url),
    )

    expect(response.statusCode).toEqual(404)
    await expect(response.body.json()).resolves.toEqual({
      error: 'NotFoundError',
      message: 'Bad cid check',
    })
  })
})
