import { Server } from '../../../lexicon'
import { InvalidRequestError } from '@adxp/xrpc-server'
import * as util from '../../../util'
import { Repo } from '@adxp/repo'
import { AuthStore } from '@adxp/auth'
import { PlcClient } from '@adxp/plc'

export default function (server: Server) {
  server.todo.adx.getAccountsConfig((_params, _input, _req, res) => {
    const cfg = util.getConfig(res)

    let availableUserDomains: string[]
    if (cfg.debugMode && cfg.didTestRegistry) {
      availableUserDomains = ['test']
    } else {
      throw new Error('TODO')
    }

    const inviteCodeRequired = true // TODO

    return {
      encoding: 'application/json',
      body: { availableUserDomains, inviteCodeRequired },
    }
  })

  server.todo.adx.getAccount(() => {
    // TODO
    return { encoding: '', body: {} }
  })

  server.todo.adx.createAccount(async (_params, input, _req, res) => {
    const { email, username, password } = input.body
    const { db, blockstore, auth, config, keypair } = util.getLocals(res)

    if (username.startsWith('did:')) {
      throw new InvalidRequestError(
        'Cannot register a username that starts with `did:`',
      )
    }

    let isTestUser = false
    if (username.endsWith('.test')) {
      if (!config.debugMode || !config.didTestRegistry) {
        throw new InvalidRequestError(
          'Cannot register a test user if debug mode is not enabled',
        )
      }
      if (!username.endsWith('.test')) {
        throw new Error(`Cannot use did:test with non-*.test username`)
      }
      isTestUser = true
    }

    // verify username is available
    const found = await db.getUser(username)
    if (found !== null) {
      throw new InvalidRequestError(`Username already taken: ${username}`)
    }

    // check user-supplied DID
    let did: string
    if (isTestUser) {
      const name = username.slice(0, username.length - '.test'.length)
      did = 'did:test:' + name
    } else {
      const plcClient = new PlcClient(config.didPlcUrl)
      // @TODO real service name
      did = await plcClient.createDid(
        keypair,
        keypair.did(),
        username,
        config.origin,
      )
    }

    await db.registerUser(email, username, did, password)

    const authStore = await AuthStore.fromTokens(keypair, [])
    const repo = await Repo.create(blockstore, did, authStore)
    await db.setRepoRoot(did, repo.cid)

    if (isTestUser) {
      config.didTestRegistry?.set(username.slice(0, -5), {
        name: username,
        service: config.origin,
      })
    }

    const jwt = auth.createToken(did)
    return { encoding: 'application/json', body: { jwt, username, did } }
  })

  server.todo.adx.deleteAccount(() => {
    // TODO
    return { encoding: '', body: {} }
  })
}
