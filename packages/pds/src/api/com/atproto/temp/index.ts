import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import importRepo from './importRepo'
import transferAccount from './transferAccount'

export default function (server: Server, ctx: AppContext) {
  importRepo(server, ctx)
  transferAccount(server, ctx)
}
