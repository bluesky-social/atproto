import { BlobStore } from '@atproto/repo'
import Database from '../db'
import { MessageQueue } from '../event-stream/types'
import { ActorService } from './actor'
import { AuthService } from './auth'
import { RecordService } from './record'
import { RepoService } from './repo'

export function createServices(
  messageQueue: MessageQueue,
  blobstore: BlobStore,
): Services {
  return {
    actor: ActorService.creator(),
    auth: AuthService.creator(),
    record: RecordService.creator(messageQueue),
    repo: RepoService.creator(messageQueue, blobstore),
  }
}

export type Services = {
  actor: FromDb<ActorService>
  auth: FromDb<AuthService>
  record: FromDb<RecordService>
  repo: FromDb<RepoService>
}

type FromDb<T> = (db: Database) => T
