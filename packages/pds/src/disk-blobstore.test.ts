import { randomBytes } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { cidForRawBytes } from '@atproto/lex-data'
import { DiskBlobStore } from './disk-blobstore.js'

describe('DiskBlobStore', () => {
  let dir: string
  let store: DiskBlobStore

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'disk-blobstore-'))
    store = new DiskBlobStore(
      'did:example:alice',
      path.join(dir, 'blobs'),
      path.join(dir, 'temp'),
      path.join(dir, 'quarantine'),
    )
  })

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  // Making blobs permanent happens outside of the actor db transaction, so
  // two writes that reference the same blob can do it at the same time. The
  // second one skips the copy as soon as the stored path exists, so that path
  // must never hold a partial blob.
  it('makePermanent() never exposes a partial blob at the stored path', async () => {
    const bytes = randomBytes(32 * 1024 * 1024)
    const cid = await cidForRawBytes(bytes)
    const key = await store.putTemp(bytes)
    const storedPath = store.getStoredPath(cid)

    let done = false
    const moving = store.makePermanent(key, cid).finally(() => {
      done = true
    })
    const sizesSeen = new Set<number>()
    while (!done) {
      const stat = await fs.stat(storedPath).catch(() => null)
      if (stat) sizesSeen.add(stat.size)
    }
    await moving

    expect([...sizesSeen].filter((size) => size !== bytes.length)).toEqual([])
    expect((await fs.readFile(storedPath)).equals(bytes)).toBe(true)
    expect(await fs.readdir(path.dirname(storedPath))).toEqual([
      path.basename(storedPath),
    ])
  })
})
