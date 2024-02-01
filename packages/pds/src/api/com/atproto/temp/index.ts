import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import checkSignupQueue from './checkSignupQueue'
import importRepo from './importRepo'
import pushBlob from './pushBlob'
import transferAccount from './transferAccount'

export default function (server: Server, ctx: AppContext) {
  checkSignupQueue(server, ctx)
  importRepo(server, ctx)
  pushBlob(server, ctx)
  transferAccount(server, ctx)
}
