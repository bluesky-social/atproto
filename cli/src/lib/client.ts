import path from 'path'
import {
  IpldStore,
  MicroblogClient,
  MicroblogDelegator,
  MicroblogFull,
  Repo,
} from '@bluesky/common'
import * as config from '../lib/config.js'

export const loadClient = async (
  repoPath: string,
): Promise<MicroblogClient> => {
  return await loadFull(repoPath)
}

export const loadFull = async (repoPath: string): Promise<MicroblogFull> => {
  const { account, keypair, ucanStore, root } = await config.loadCfg(repoPath)
  const blockstore = IpldStore.createPersistent(
    path.join(repoPath, 'blockstore'),
  )
  let repo: Repo
  if (!root) {
    repo = await Repo.create(blockstore, keypair.did(), keypair, ucanStore)
  } else {
    repo = await Repo.load(blockstore, root, keypair, ucanStore)
  }
  return new MicroblogFull(repo, `http://${account.server}`, {
    onPush: async (newRoot) => {
      await config.writeRoot(repoPath, newRoot)
    },
  })
}

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
