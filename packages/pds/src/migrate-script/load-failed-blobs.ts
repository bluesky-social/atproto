import fs from 'fs/promises'
import { chunkArray } from '@atproto/common'
import { getDb } from './db'

const run = async () => {
  const file = await fs.readFile('missing-blobs.txt')
  const rows = file
    .toString()
    .split('\n')
    .filter((row) => row.length > 5)
    .map((row) => {
      const [did, cid] = row.split(' ')
      return {
        did: did.trim(),
        cid: cid.trim(),
      }
    })
  const db = getDb()

  await Promise.all(
    chunkArray(rows, 500).map((chunk) =>
      db
        .insertInto('failed_blob')
        .values(chunk)
        .onConflict((oc) => oc.doNothing())
        .execute(),
    ),
  )
}

run()
