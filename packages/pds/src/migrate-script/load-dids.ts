import fs from 'fs/promises'
import { getDb } from './db'
import { chunkArray } from '@atproto/common'

const run = async () => {
  const db = getDb()
  const didsFile = await fs.readFile('dids.txt')
  const dids = didsFile
    .toString()
    .split('\n')
    .map((did) => ({
      did: did.trim(),
      phase: 0,
      failed: 0 as const,
    }))
    .filter((row) => row.did.length > 2)
  await Promise.all(
    chunkArray(dids, 50).map((chunk) =>
      db
        .insertInto('status')
        .values(chunk)
        .onConflict((oc) => oc.doNothing())
        .execute(),
    ),
  )
}

run()
