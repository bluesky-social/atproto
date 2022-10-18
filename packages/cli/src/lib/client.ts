import path from 'path'
import {
  IpldStore,
  MicroblogClient,
  MicroblogDelegator,
  MicroblogFull,
  Repo,
} from '@atproto/common'
import * as config from '../lib/config'

export const loadClient = async (
  repoPath: string,
): Promise<MicroblogClient> => {
  const cfg = await config.loadCfg(repoPath)
  if (cfg.account.delegator) {
    return loadDelegate(cfg)
  } else {
    return loadFull(cfg, repoPath)
  }
}

export const loadFull = async (
  cfg: config.Config,
  repoPath: string,
): Promise<MicroblogFull> => {
  const { account, authStore, root } = cfg
  const blockstore = IpldStore.createPersistent(
    path.join(repoPath, 'blockstore'),
  )
  let repo: Repo
  if (!root) {
    repo = await Repo.create(blockstore, await authStore.did(), authStore)
  } else {
    repo = await Repo.load(blockstore, root, authStore)
  }
  return new MicroblogFull(repo, `http://${account.server}`, {
    onPush: async (newRoot) => {
      await config.writeRoot(repoPath, newRoot)
    },
  })
}

export const loadDelegate = async (
  cfg: config.Config,
): Promise<MicroblogDelegator> => {
  const { account, authStore } = cfg
  return new MicroblogDelegator(
    `http://${account.server}`,
    await authStore.did(),
    authStore,
  )
}
