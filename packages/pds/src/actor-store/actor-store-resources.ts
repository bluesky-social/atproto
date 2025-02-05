import { BlobStore } from '@atproto/repo'
import { BackgroundQueue } from '../background'

export type ActorStoreResources = {
  blobstore: (did: string) => BlobStore
  backgroundQueue: BackgroundQueue
  reservedKeyDir?: string
}
