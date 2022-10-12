import { Server } from '../../../lexicon'
import { AuthRequiredError, InvalidRequestError } from '@adxp/xrpc-server'
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

    const result = await db.db
      .updateTable('user')
      .set({ lastSeenNotifs: parsed })
      .where('did', '=', requester)
      .executeTakeFirst()

    if (Number(result.numUpdatedRows) < 1) {
      throw new InvalidRequestError(`Could not find user: ${requester}`)
    }

    return { encoding: 'application/json', body: {} }
  })
}
