import AppContext from '../../../context'
import { Server } from '../../../lexicon'
import account from './account'
import blob from './blob'
import handles from './handles'
import invites from './invites'
import passwordReset from './password-reset'
import repo from './repo'
import session from './session'
import sync from './sync'

export default function (server: Server, ctx: AppContext) {
  account(server, ctx)
  blob(server, ctx)
  handles(server, ctx)
  invites(server, ctx)
  passwordReset(server, ctx)
  repo(server, ctx)
  session(server, ctx)
  sync(server, ctx)
}
