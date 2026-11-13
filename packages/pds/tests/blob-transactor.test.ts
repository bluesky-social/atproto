import crypto from 'node:crypto'
import { Readable } from 'node:stream'
import { cidForRawHash } from '@atproto/lex-data'
import type { BlobStore } from '@atproto/repo'
import { BlobTransactor } from '../src/actor-store/blob/transactor.js'
import type { ActorDb } from '../src/actor-store/db/index.js'
import type { BackgroundQueue } from '../src/background.js'

describe('BlobTransactor', () => {
  it('drains the MIME stream without stalling other consumers', async () => {
    const size = 25 * 1024 * 1024
    const chunkSize = 16 * 1024
    const file = Buffer.alloc(size)
    file.set([0xff, 0xd8, 0xff]) // JPEG magic number

    let uploadedSize = 0
    const blobstore = {
      async putTemp(bytes) {
        if (bytes instanceof Uint8Array) {
          uploadedSize = bytes.byteLength
        } else {
          for await (const chunk of bytes) {
            uploadedSize += Buffer.byteLength(chunk)
          }
        }
        return 'temp-key'
      },
    } as BlobStore
    const transactor = new BlobTransactor(
      {} as ActorDb,
      blobstore,
      {} as BackgroundQueue,
    )
    const stream = Readable.from(
      (function* () {
        for (let offset = 0; offset < file.length; offset += chunkSize) {
          yield file.subarray(offset, offset + chunkSize)
        }
      })(),
      { objectMode: false },
    )

    const metadata = await transactor.uploadBlobAndGetMetadata(stream)

    expect(uploadedSize).toBe(file.byteLength)
    expect(metadata).toEqual({
      tempKey: 'temp-key',
      size: file.byteLength,
      cid: cidForRawHash(crypto.createHash('sha256').update(file).digest()),
      mimeType: 'image/jpeg',
    })
  }, 5000)
})
