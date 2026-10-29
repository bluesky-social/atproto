import { jest } from '@jest/globals'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import { BlobDiverter } from '../src/daemon/blob-diverter.js'

describe('blob diversion size limit', () => {
  afterEach(() => jest.restoreAllMocks())

  async function download(body: string, contentLength?: number) {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(body, {
        headers:
          contentLength === undefined
            ? {}
            : { 'content-length': String(contentLength) },
      }),
    )
    const diverter = new BlobDiverter(null as never, {
      idResolver: null as never,
      serviceConfig: {
        url: 'https://divert.example.com',
        adminPassword: 'password',
        maxBytes: 4,
      },
    })
    const cid = CID.createV1(
      0x55,
      await sha256.digest(new TextEncoder().encode(body)),
    )
    const blob = await diverter.getBlob({
      pds: 'https://api.bsky.app',
      did: 'did:plc:example',
      cid: cid.toString(),
    })
    const chunks: Buffer[] = []
    for await (const chunk of blob.stream) chunks.push(chunk)
    return Buffer.concat(chunks).toString()
  }

  it('accepts a blob at the configured limit', async () => {
    await expect(download('abcd', 4)).resolves.toBe('abcd')
  })

  it('rejects an oversized content length', async () => {
    await expect(download('abcde', 5)).rejects.toThrow('Error fetching blob')
  })

  it('rejects an oversized streamed body without a content length', async () => {
    await expect(download('abcde')).rejects.toThrow('Response too large')
  })
})
