import { Server } from '../../../lexicon'
import handles from './handles'
import session from './session'
import account from './account'
import passwordReset from './password-reset'
import repo from './repo'
import sync from './sync'
import invites from './invites'

export default function (server: Server) {
  handles(server)
  session(server)
  account(server)
  passwordReset(server)
  repo(server)
  sync(server)
  invites(server)
}
