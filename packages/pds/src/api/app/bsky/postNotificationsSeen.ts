import { Server } from '../../../lexicon'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import * as locals from '../../../locals'

export default function (server: Server) {
  server.app.bsky.postNotificationsSeen(async (_params, input, req, res) => {
    const { seenAt } = input.body
    const { auth, db } = locals.get(res)

    const requester = auth.getUserDid(req)
    if (!requester) {
      throw new AuthRequiredError()
    }

    let parsed: string
    try {
      parsed = new Date(seenAt).toISOString()
    } catch (_err) {
      throw new InvalidRequestError('Invalid date')
    }

    const user = await db.getUser(requester)
    if (!user) {
      throw new InvalidRequestError(`Could not find user: ${requester}`)
    }

    await db.db
      .updateTable('user')
      .set({ lastSeenNotifs: parsed })
      .where('username', '=', user.username)
      .executeTakeFirst()

    return { encoding: 'application/json', body: {} }
  })
}
