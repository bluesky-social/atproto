import axios, { AxiosInstance } from 'axios'
import { CID } from 'multiformats/cid'
import { AtpAgent } from '@atproto/api'
import { verifyCidForBytes } from '@atproto/common'
import { runTestServer, TestServerInfo } from './_util'
import { SeedClient } from './seeds/client'
import basicSeed from './seeds/basic'
import { randomBytes } from '@atproto/crypto'

describe('blob resolver', () => {
  let server: TestServerInfo
  let client: AxiosInstance
  let fileDid: string
  let fileCid: CID

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'blob_resolver',
    })
    const pdsAgent = new AtpAgent({ service: server.pdsUrl })
    const sc = new SeedClient(pdsAgent)
    await basicSeed(sc)
    fileDid = sc.dids.carol
    fileCid = sc.posts[fileDid][0].images[0].image.ref
    client = axios.create({
      baseURL: server.url,
      validateStatus: () => true,
    })
  })

  afterAll(async () => {
    if (server) server.close()
  })

  it('resolves blob with good signature check.', async () => {
    const { data, status } = await client.get(
      `/blob/${fileDid}/${fileCid.toString()}`,
      { responseType: 'arraybuffer' },
    )
    expect(status).toEqual(200)
    await expect(verifyCidForBytes(fileCid, data)).resolves.toBeUndefined()
  })

  it('404s on missing blob.', async () => {
    const { data, status } = await client.get(
      `/blob/did:plc:unknown/${fileCid.toString()}`,
    )
    expect(status).toEqual(404)
    expect(data).toEqual({
      error: 'NotFoundError',
      message: 'Blob not found',
    })
  })

  it('400s on invalid did.', async () => {
    const { data, status } = await client.get(
      `/blob/did::/${fileCid.toString()}`,
    )
    expect(status).toEqual(400)
    expect(data).toEqual({
      error: 'BadRequestError',
      message: 'Invalid did',
    })
  })

  it('400s on invalid cid.', async () => {
    const { data, status } = await client.get(`/blob/${fileDid}/barfy`)
    expect(status).toEqual(400)
    expect(data).toEqual({
      error: 'BadRequestError',
      message: 'Invalid cid',
    })
  })

  it('fails on blob with bad signature check.', async () => {
    await server.pds.ctx.blobstore.delete(fileCid)
    await server.pds.ctx.blobstore.putPermanent(fileCid, randomBytes(100))
    const tryGetBlob = client.get(`/blob/${fileDid}/${fileCid.toString()}`)
    await expect(tryGetBlob).rejects.toThrow(
      'maxContentLength size of -1 exceeded',
    )
  })
})
