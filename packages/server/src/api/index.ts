import { createServer } from '../xrpc'
import names from './names'
import session from './session'
import account from './account'
import repo from './repo'
import sync from './sync'

export default function () {
  const server = createServer()
  names(server)
  session(server)
  account(server)
  repo(server)
  sync(server)
  return server
}
