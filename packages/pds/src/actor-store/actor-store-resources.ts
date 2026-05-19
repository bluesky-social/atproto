import { BlobStore } from '@atproto/repo'
import { BackgroundQueue } from '../background.js'

export type ActorStoreResources = {
  blobstore: (did: string) => BlobStore
  backgroundQueue: BackgroundQueue
  reservedKeyDir?: string
}
