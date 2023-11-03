import fs from 'fs/promises'
import { getDb } from './db'

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
  await db
    .insertInto('status')
    .values(dids)
    .onConflict((oc) => oc.doNothing())
    .execute()
}

run()
