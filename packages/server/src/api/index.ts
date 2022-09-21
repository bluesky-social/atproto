import { createServer } from '../xrpc'
import todoAdx from './todo/adx'
import todoSocial from './todo/social'

export default function () {
  const server = createServer()
  todoAdx(server)
  todoSocial(server)
  return server
}
