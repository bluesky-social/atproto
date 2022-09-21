import { Server } from '../../../lexicon'
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
    const cfg = util.getConfig(res)

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

    let isTestUser = false
    if (username.endsWith('.test') || did.startsWith('did:test:')) {
      if (!cfg.debugMode || !cfg.didTestRegistry) {
        throw new InvalidRequestError(
          'Cannot register a test user if debug mode is not enabled',
        )
      }
      if (!username.endsWith('.test')) {
        throw new Error(`Cannot use did:test with non-*.test username`)
      }
      if (!did.startsWith('did:test:')) {
        throw new Error(`Cannot use *.test with a non did:test:* DID`)
      }
      isTestUser = true
    }

    const { db, blockstore, keypair } = util.getLocals(res)
    await db.registerUser(username, did)

    const authStore = await auth.AuthStore.fromTokens(keypair, [])
    const repo = await Repo.create(blockstore, did, authStore)
    await db.setRepoRoot(did, repo.cid)

    if (isTestUser) {
      cfg.didTestRegistry?.set(username.slice(0, -5), {
        name: username,
        service: cfg.origin,
      })
    }

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
