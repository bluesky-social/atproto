import { Server } from '../../../lexicon'
import { InvalidRequestError } from '@adxp/xrpc-server'
import * as util from '../../../util'
import { Repo } from '@adxp/repo'
import { AuthStore } from '@adxp/auth'

export default function (server: Server) {
  server.todo.adx.getAccount(() => {
    // TODO
    return { encoding: '', body: {} }
  })

  server.todo.adx.createAccount(async (_params, input, _req, res) => {
    const { did, username, password } = input.body
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

    const { db, blockstore, keypair, auth } = util.getLocals(res)
    await db.registerUser(username, did, password)

    const authStore = await AuthStore.fromTokens(keypair, [])
    const repo = await Repo.create(blockstore, did, authStore)
    await db.setRepoRoot(did, repo.cid)

    if (isTestUser) {
      cfg.didTestRegistry?.set(username.slice(0, -5), {
        name: username,
        service: cfg.origin,
      })
    }

    const jwt = auth.createToken(did)
    return { encoding: 'application/json', body: { jwt } }
  })

  server.todo.adx.deleteAccount(() => {
    // TODO
    return { encoding: '', body: {} }
  })
}
