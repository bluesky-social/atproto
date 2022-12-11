import { BlobStore } from '@atproto/repo'
import Database from '../db'
import { MessageQueue } from '../stream/types'
import { ActorService } from './actor'
import { RecordService } from './record'
import { RepoService } from './repo'

export function createServices(
  db: Database,
  messageQueue: MessageQueue,
  blobstore: BlobStore,
): Services {
  const actor = new ActorService(db)
  const record = new RecordService(db, messageQueue)
  const repo = new RepoService(db, messageQueue, blobstore)
  return { actor, record, repo }
}

export type Services = {
  actor: ActorService
  record: RecordService
  repo: RepoService
}
