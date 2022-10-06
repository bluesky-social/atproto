import { ForbiddenError } from '@adxp/xrpc-server'
import * as crypto from '@adxp/crypto'
import * as uint8arrays from 'uint8arrays'
import { InviteCode } from '../../../db/invite-codes'
import { Server } from '../../../lexicon'
import * as locals from '../../../locals'

export default function (server: Server) {
  server.todo.adx.createInviteCode(async (_params, input, req, res) => {
    const { auth, db, config, logger } = locals.get(res)
    if (!auth.verifyAdmin(req)) {
      throw new ForbiddenError()
    }
    const { useCount } = input.body

    // generate a 5 char b32 invite code - preceeded by the hostname
    // ex: bsky.app-abc12
    const code =
      config.hostname +
      '-' +
      uint8arrays.toString(await crypto.randomBytes(5), 'base32').slice(0, 5)

    const invite = new InviteCode()
    invite.code = code
    invite.availableUses = useCount
    invite.createdBy = 'admin'
    invite.forUser = 'admin'

    await db.db.getRepository(InviteCode).insert(invite)

    logger.info({ useCount, code }, 'created invite code')

    return {
      encoding: 'application/json',
      body: { code },
    }
  })
}
