import { AuthRequiredError, ForbiddenError } from '@adxp/xrpc-server'
import * as crypto from '@adxp/crypto'
import * as uint8arrays from 'uint8arrays'
import { InviteCode } from '../../../db/invite-codes'
import { Server } from '../../../lexicon'
import * as util from '../../../util'

export default function (server: Server) {
  server.todo.adx.createInviteCode(async (_params, input, req, res) => {
    const { auth, db, config } = util.getLocals(res)
    const requester = auth.getUserDid(req)
    if (!requester) {
      throw new AuthRequiredError()
    }
    if (config.adminDids.indexOf(requester) < 0) {
      throw new ForbiddenError()
    }

    // generate a 5 char b32 invite code
    const code =
      config.hostname +
      '-' +
      uint8arrays.toString(await crypto.randomBytes(5), 'base32').slice(0, 5)

    const invite = new InviteCode()
    invite.code = code
    invite.availableUses = input.body.useCount
    invite.createdBy = requester
    invite.forUser = requester

    await db.db.getRepository(InviteCode).insert(invite)

    return {
      encoding: 'application/json',
      body: { code },
    }
  })
}
