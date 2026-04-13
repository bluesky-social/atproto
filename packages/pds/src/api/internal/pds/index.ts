import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../context'
import getActorStoreMigrationStatus from './getActorStoreMigrationStatus'

export default function (server: Server, ctx: AppContext) {
  getActorStoreMigrationStatus(server, ctx)
}
