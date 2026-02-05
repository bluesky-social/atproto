import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import admin from './trustanchor/admin'

export default function (server: Server, ctx: AppContext) {
  admin(server, ctx)
}
