import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../lexicon'
import * as locals from '../../../locals'

export default function (server: Server) {
  server.com.atproto.getSession(async (_params, _input, req, res) => {
    const { db, auth } = locals.get(res)
    const did = auth.getUserDid(req)
    if (!did) {
      throw new AuthRequiredError()
    }

    const user = await db.getUser(did)
    if (!user) {
      throw new InvalidRequestError(
        `Could not find user info for account: ${did}`,
      )
    }
    return {
      encoding: 'application/json',
      body: { name: user.username, did: user.did },
    }
  })

  server.com.atproto.createSession(async (_params, input, _req, res) => {
    const { username, password } = input.body
    const { db, auth } = locals.get(res)
    const validPass = await db.verifyUserPassword(username, password)
    if (!validPass) {
      throw new AuthRequiredError('Invalid username or password')
    }

    const user = await db.getUser(username)
    if (!user) {
      throw new InvalidRequestError(
        `Could not find user info for account: ${username}`,
      )
    }

    const jwt = auth.createToken(user.did)
    return {
      encoding: 'application/json',
      body: { jwt, name: user.username, did: user.did },
    }
  })

  server.com.atproto.deleteSession(() => {
    throw new InvalidRequestError('Not implemented')
  })
}
