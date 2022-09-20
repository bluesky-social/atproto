import { Server } from '../../../xrpc'
import names from './names'
import session from './session'
import account from './account'
import repo from './repo'
import sync from './sync'

export default function (server: Server) {
  names(server)
  session(server)
  account(server)
  repo(server)
  sync(server)
}
