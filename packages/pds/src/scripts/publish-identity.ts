import fs from 'node:fs/promises'
import { wait } from '@atproto/common'
import { Sequencer } from '../sequencer'
import { parseIntArg } from './util'

export type PublishIdentityContext = {
  sequencer: Sequencer
}

export const publishIdentity = async (
  ctx: PublishIdentityContext,
  args: string[],
) => {
  const dids = args
  await publishIdentityEvtForDids(ctx, dids)
  console.log('DONE')
}

export const publishIdentityFromFile = async (
  ctx: PublishIdentityContext,
  args: string[],
) => {
  const filepath = args[0]
  if (!filepath) {
    throw new Error('Expected filepath as argument')
  }
  const timeBetween = args[1] ? parseIntArg(args[1]) : 5
  const file = await fs.readFile(filepath)
  const dids = file
    .toString()
    .split('\n')
    .map((did) => did.trim())

  await publishIdentityEvtForDids(ctx, dids, timeBetween)
  console.log('DONE')
}

export const publishIdentityEvtForDids = async (
  ctx: PublishIdentityContext,
  dids: string[],
  timeBetween = 0,
) => {
  for (const did of dids) {
    try {
      await ctx.sequencer.sequenceIdentityEvt(did)
      console.log(`published identity evt for ${did}`)
    } catch (err) {
      console.error(`failed to sequence new identity evt for ${did}: ${err}`)
    }
    if (timeBetween > 0) {
      await wait(timeBetween)
    }
  }
}
