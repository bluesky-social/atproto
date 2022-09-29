import { Server } from '../../../lexicon'
import { InvalidRequestError } from '@adxp/xrpc-server'
import * as util from '../../../util'
import { Repo } from '@adxp/repo'
import { PlcClient } from '@adxp/plc'

export default function (server: Server) {
  server.todo.adx.getAccountsConfig((_params, _input, _req, res) => {
    const cfg = util.getConfig(res)

    let availableUserDomains: string[]
    if (cfg.debugMode && !!cfg.testNameRegistry) {
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
      return {
        status: 400,
        error: 'InvalidUsername',
        message: 'Cannot register a username that starts with `did:`',
      }
    }

    let isTestUser = false
    if (username.endsWith('.test')) {
      if (!config.debugMode || !config.testNameRegistry) {
        throw new InvalidRequestError(
          'Cannot register a test user if debug mode is not enabled',
        )
      }
      isTestUser = true
    }

    // verify username is available
    const found = await db.getUser(username)
    if (found !== null) {
      throw new InvalidRequestError(`Username already taken: ${username}`)
    }

    const plcClient = new PlcClient(config.didPlcUrl)
    // @TODO real service name
    const did = await plcClient.createDid(
      keypair,
      keypair.did(),
      username,
      config.origin,
    )

    await db.registerUser(email, username, did, password)

    const authStore = util.getAuthstore(res, did)
    const repo = await Repo.create(blockstore, did, authStore)
    await db.setRepoRoot(did, repo.cid)

    if (isTestUser && config.testNameRegistry) {
      config.testNameRegistry[username] = did
    }

    const jwt = auth.createToken(did)
    return { encoding: 'application/json', body: { jwt, username, did } }
  })

  server.todo.adx.deleteAccount(() => {
    // TODO
    return { encoding: '', body: {} }
  })
}
