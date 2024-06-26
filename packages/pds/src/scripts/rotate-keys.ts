import fs from 'node:fs/promises'
import PQueue from 'p-queue'
import AppContext from '../context'
import { updatePlcSigningKey } from './common'

export const rotateKeys = async (ctx: AppContext, args: string[]) => {
  const filepath = args[0]
  if (!filepath) {
    throw new Error('Expected filepath as argument')
  }
  const concurrency = args[1] ? parseInt(args[1]) : 25
  const file = await fs.readFile(filepath)
  const dids = file
    .toString()
    .split('\n')
    .map((did) => did.trim())
    .filter((did) => did.startsWith('did:plc'))

  const queue = new PQueue({ concurrency })
  for (const did of dids) {
    queue.add(async () => {
      try {
        await updatePlcSigningKey(ctx, did)
      } catch (err) {
        console.log(`failed to update key for ${did}: ${err}`)
      }
    })
  }
}
