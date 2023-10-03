import { AtpAgent } from '@atproto/api'
import * as crypto from '@atproto/crypto'
import { BlobStore } from '@atproto/repo'
import Database from '../db'
import { AccountService } from './account'
import { AuthService } from './auth'
import { ModerationService } from './moderation'

export function createServices(resources: {
  repoSigningKey: crypto.Keypair
  blobstore: BlobStore
  pdsHostname: string
  appViewAgent?: AtpAgent
  appViewDid?: string
  appViewCdnUrlPattern?: string
}): Services {
  const { blobstore } = resources
  return {
    account: AccountService.creator(),
    auth: AuthService.creator(),
    moderation: ModerationService.creator(blobstore),
  }
}

export type Services = {
  account: FromDb<AccountService>
  auth: FromDb<AuthService>
  moderation: FromDb<ModerationService>
}

type FromDb<T> = (db: Database) => T
