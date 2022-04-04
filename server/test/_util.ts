import * as ucan from 'ucans'

import { MicroblogDelegator, auth } from '@bluesky-demo/common'

export const newClient = async (url: string): Promise<MicroblogDelegator> => {
  const key = await ucan.EdKeypair.create()
  const token = await auth.claimFull(key.did(), key)
  const ucans = await ucan.Store.fromTokens([token.encoded()])
  return new MicroblogDelegator(url, key.did(), key, ucans)
}
