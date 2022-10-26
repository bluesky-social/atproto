import { Server } from '../../../lexicon'
import names from './names'
import session from './session'
import account from './account'
import passwordReset from './password-reset'
import repo from './repo'
import sync from './sync'
import invites from './invites'

export default function (server: Server) {
  names(server)
  session(server)
  account(server)
  passwordReset(server)
  repo(server)
  sync(server)
  invites(server)
}
