import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import importRepo from './importRepo'
import pushBlob from './pushBlob'
import transferAccount from './transferAccount'

export default function (server: Server, ctx: AppContext) {
  importRepo(server, ctx)
  pushBlob(server, ctx)
  transferAccount(server, ctx)
}
