import { MicroblogDelegator } from '@bluesky/common'
import * as config from '../lib/config.js'

export const loadDelegate = async (
  repoPath: string,
): Promise<MicroblogDelegator> => {
  const { account, keypair, ucanStore } = await config.loadCfg(repoPath)
  return new MicroblogDelegator(
    `http://${account.server}`,
    keypair.did(),
    keypair,
    ucanStore,
  )
}
