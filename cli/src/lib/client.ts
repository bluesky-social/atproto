import path from 'path'
import {
  IpldStore,
  MicroblogClient,
  MicroblogDelegator,
  MicroblogFull,
  Repo,
} from '@adxp/common'
import * as config from '../lib/config.js'

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
  const { account, keypair, ucanStore, root } = cfg
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
  cfg: config.Config,
): Promise<MicroblogDelegator> => {
  const { account, keypair, ucanStore } = cfg
  return new MicroblogDelegator(
    `http://${account.server}`,
    keypair.did(),
    keypair,
    ucanStore,
  )
}
