import { PrimaryDatabase } from '../db'
import { ActorService } from '../services/actor'
import { ImageUriBuilder } from '../image/uri'
import { GraphService } from '../services/graph'
import { LabelService } from '../services/label'

export function createServices(resources: {
  imgUriBuilder: ImageUriBuilder
}): Services {
  const { imgUriBuilder } = resources
  const graph = GraphService.creator(imgUriBuilder)
  const label = LabelService.creator(null)
  return {
    actor: ActorService.creator(imgUriBuilder, graph, label),
  }
}

export type Services = {
  actor: FromDbPrimary<ActorService>
}

type FromDbPrimary<T> = (db: PrimaryDatabase) => T
