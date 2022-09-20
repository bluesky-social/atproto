import { Server } from '../../../xrpc'

export default function (server: Server) {
  server.todo.adx.getSession(() => {
    // TODO
    return { encoding: '', body: {} }
  })
  server.todo.adx.createSession(() => {
    // TODO
    return { encoding: '', body: {} }
  })
  server.todo.adx.deleteSession(() => {
    // TODO
    return { encoding: '', body: {} }
  })
}
