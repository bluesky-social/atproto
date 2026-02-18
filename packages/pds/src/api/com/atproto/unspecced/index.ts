import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import getActorStoreMigrationStatus from './getActorStoreMigrationStatus'

export default function (server: Server, ctx: AppContext) {
  getActorStoreMigrationStatus(server, ctx)
}
