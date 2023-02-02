import AppContext from '../../../context'
import { Server } from '../../../lexicon'
import account from './account'
import admin from './admin'
import blob from './blob'
import getAccountsConfig from './getAccountsConfig'
import handles from './handles'
import repo from './repo'
import report from './report'
import session from './session'
import sync from './sync'

export default function (server: Server, ctx: AppContext) {
  account(server, ctx)
  admin(server, ctx)
  blob(server, ctx)
  getAccountsConfig(server, ctx)
  handles(server, ctx)
  repo(server, ctx)
  report(server, ctx)
  session(server, ctx)
  sync(server, ctx)
}
