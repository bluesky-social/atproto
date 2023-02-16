import { Server } from '../../lexicon'
import appBsky from './app/bsky'
import AppContext from '../../context'

export default function (server: Server, ctx: AppContext) {
  appBsky(server, ctx)
  return server
}
