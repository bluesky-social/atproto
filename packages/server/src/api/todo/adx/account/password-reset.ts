import { Server } from '../../../../lexicon'

export default function (server: Server) {
  server.todo.adx.requestAccountPasswordReset(() => {
    // @TODO
    return {
      encoding: 'application/json',
      body: {},
    }
  })

  server.todo.adx.resetAccountPassword(() => {
    // @TODO
    return {
      encoding: 'application/json',
      body: {},
    }
  })
}
