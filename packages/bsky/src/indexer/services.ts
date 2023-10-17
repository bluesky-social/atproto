import { IdResolver } from '@atproto/identity'
import { PrimaryDatabase } from '../db'
import { BackgroundQueue } from '../background'
import { IndexingService } from '../services/indexing'
import { LabelService } from '../services/label'
import { NotificationServer } from '../notifications'
import { AutoModerator } from '../auto-moderator'

export function createServices(resources: {
  idResolver: IdResolver
  autoMod: AutoModerator
  backgroundQueue: BackgroundQueue
  notifServer?: NotificationServer
}): Services {
  const { idResolver, autoMod, backgroundQueue, notifServer } = resources
  return {
    indexing: IndexingService.creator(
      idResolver,
      autoMod,
      backgroundQueue,
      notifServer,
    ),
    label: LabelService.creator(null),
  }
}

export type Services = {
  indexing: FromDbPrimary<IndexingService>
  label: FromDbPrimary<LabelService>
}

type FromDbPrimary<T> = (db: PrimaryDatabase) => T
