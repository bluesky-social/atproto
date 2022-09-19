import { createServer } from '../xrpc'
import names from './names'
import session from './session'
import account from './account'

export default function () {
  const server = createServer()
  names(server)
  session(server)
  account(server)
  return server
}
