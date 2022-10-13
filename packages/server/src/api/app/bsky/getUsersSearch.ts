import { Server } from '../../../lexicon'

export default function (server: Server) {
  server.app.bsky.getUsersSearch(async (/*params, _input, _req, res*/) => {
    // const { x } = params
    // const { db } = locals.get(res)
    return {
      encoding: 'application/json',
      body: {
        users: [],
      },
    }
  })
}
