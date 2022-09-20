import { Server } from '../../../xrpc'
import { InvalidRequestError } from '@adxp/xrpc-server'
import * as util from '../../../util'
import { Repo } from '@adxp/repo'
import * as auth from '@adxp/auth'

export default function (server: Server) {
  server.todo.adx.getAccount(() => {
    // TODO
    return { encoding: '', body: {} }
  })

  server.todo.adx.createAccount(async (_params, input, _req, res) => {
    const { did, username } = input.body
    if (username.startsWith('did:')) {
      throw new InvalidRequestError(
        'Cannot register a username that starts with `did:`',
      )
    }
    if (!did.startsWith('did:')) {
      throw new InvalidRequestError(
        'Cannot register a did that does not start with `did:`',
      )
    }

    const { db, blockstore, keypair } = util.getLocals(res)
    await db.registerUser(username, did)

    const authStore = await auth.AuthStore.fromTokens(keypair, [])
    const repo = await Repo.create(blockstore, did, authStore)
    await db.setRepoRoot(did, repo.cid)

    // const authStore = await serverAuth.checkReq(
    //   req,
    //   res,
    //   auth.maintenanceCap(did),
    // )
    // const host = util.getOwnHost(req)

    // if (await db.isNameRegistered(username, host)) {
    //   throw new ServerError(409, 'Username already taken')
    // } else if (await db.isDidRegistered(did)) {
    //   throw new ServerError(409, 'Did already registered')
    // }

    // await db.registerDid(username, did, host)
    // // create empty repo
    // if (createRepo) {
    //   const repo = await Repo.create(blockstore, did, authStore)
    //   await db.createRepoRoot(did, repo.cid)
    // }
  })

  server.todo.adx.deleteAccount(() => {
    // TODO
    return { encoding: '', body: {} }
  })
}
