import { IdResolver } from '@atproto/identity'
import Database from '../db'
import { Labeler } from '../labeler'
import { BackgroundQueue } from '../background'
import { IndexingService } from '../services/indexing'

export function createServices(resources: {
  idResolver: IdResolver
  labeler: Labeler
  backgroundQueue: BackgroundQueue
}): Services {
  const { idResolver, labeler, backgroundQueue } = resources
  return {
    indexing: IndexingService.creator(idResolver, labeler, backgroundQueue),
  }
}

export type Services = {
  indexing: FromDb<IndexingService>
}

type FromDb<T> = (db: Database) => T
