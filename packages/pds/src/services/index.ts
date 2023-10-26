import { AtpAgent } from '@atproto/api'
import * as crypto from '@atproto/crypto'
import { BlobStore } from '@atproto/repo'
import Database from '../db'
import { AccountService } from './account'
import { AuthService } from './auth'
import { RecordService } from './record'
import { RepoService } from './repo'
import { ModerationService } from './moderation'
import { BackgroundQueue } from '../background'
import { Crawlers } from '../crawlers'
import { LocalService } from './local'
import { AuthKeys } from '../auth-verifier'

export function createServices(resources: {
  repoSigningKey: crypto.Keypair
  blobstore: BlobStore
  pdsHostname: string
  authKeys: AuthKeys
  identityDid: string
  appViewAgent?: AtpAgent
  appViewDid?: string
  appViewCdnUrlPattern?: string
  backgroundQueue: BackgroundQueue
  crawlers: Crawlers
}): Services {
  const {
    repoSigningKey,
    blobstore,
    pdsHostname,
    authKeys,
    identityDid,
    appViewAgent,
    appViewDid,
    appViewCdnUrlPattern,
    backgroundQueue,
    crawlers,
  } = resources
  return {
    account: AccountService.creator(),
    auth: AuthService.creator(identityDid, authKeys),
    record: RecordService.creator(),
    repo: RepoService.creator(
      repoSigningKey,
      blobstore,
      backgroundQueue,
      crawlers,
    ),
    local: LocalService.creator(
      repoSigningKey,
      pdsHostname,
      appViewAgent,
      appViewDid,
      appViewCdnUrlPattern,
    ),
    moderation: ModerationService.creator(blobstore),
  }
}

export type Services = {
  account: FromDb<AccountService>
  auth: FromDb<AuthService>
  record: FromDb<RecordService>
  repo: FromDb<RepoService>
  local: FromDb<LocalService>
  moderation: FromDb<ModerationService>
}

type FromDb<T> = (db: Database) => T
