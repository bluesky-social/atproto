import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import checkSignupQueue from './checkSignupQueue'

export default function (server: Server, ctx: AppContext) {
  checkSignupQueue(server, ctx)
}
