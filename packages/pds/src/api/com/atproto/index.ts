import { Server } from '../../../lexicon'
import account from './account'
import data from './data'
import handles from './handles'
import invites from './invites'
import passwordReset from './password-reset'
import repo from './repo'
import session from './session'
import sync from './sync'

export default function (server: Server) {
  account(server)
  data(server)
  handles(server)
  invites(server)
  passwordReset(server)
  repo(server)
  session(server)
  sync(server)
}
