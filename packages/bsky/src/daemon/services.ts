import { PrimaryDatabase } from '../db'
import { ActorService } from '../services/actor'
import { ImageUriBuilder } from '../image/uri'
import { LabelCache } from '../label-cache'

export function createServices(resources: {
  imgUriBuilder: ImageUriBuilder
  labelCache: LabelCache
}): Services {
  const { imgUriBuilder, labelCache } = resources
  return {
    actor: ActorService.creator(imgUriBuilder, labelCache),
  }
}

export type Services = {
  actor: FromDbPrimary<ActorService>
}

type FromDbPrimary<T> = (db: PrimaryDatabase) => T
