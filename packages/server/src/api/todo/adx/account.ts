import { Server } from '../../../lexicon'
import { InvalidRequestError } from '@adxp/xrpc-server'
import * as util from '../../../util'
import { Repo } from '@adxp/repo'
import { PlcClient } from '@adxp/plc'
import { InviteCode, InviteCodeUses } from '../../../db/invite-codes'

export default function (server: Server) {
  server.todo.adx.getAccountsConfig((_params, _input, _req, res) => {
    const cfg = util.getConfig(res)

    let availableUserDomains: string[]
    if (cfg.debugMode && !!cfg.testNameRegistry) {
      availableUserDomains = ['test']
    } else {
      throw new Error('TODO')
    }

    const inviteCodeRequired = cfg.inviteRequired

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
    const { email, username, password, inviteCode } = input.body
    const { db, blockstore, auth, config, keypair } = util.getLocals(res)

    if (config.inviteRequired) {
      if (!inviteCode) {
        return {
          status: 400,
          error: 'InvalidInviteCode',
          message: 'No invite code provided',
        }
      }
      const found = await db.db
        .createQueryBuilder()
        .select([
          'invite.disabled AS disabled',
          'invite.availableUses as availableUses',
          'COUNT(code_uses.usedBy) as useCount',
        ])
        .from(InviteCode, 'invite')
        .leftJoin(InviteCodeUses, 'code_uses', 'invite.code = code_uses.code')
        .where('invite.code = :inviteCode', { inviteCode })
        .groupBy('invite.code')
        .getRawOne()
      if (!found || found.disabled || found.useCount >= found.availableUses) {
        return {
          status: 400,
          error: 'InvalidInviteCode',
          message: 'Provided invite code not available',
        }
      }
    }

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

    if (config.inviteRequired && inviteCode) {
      const inviteCodeUse = new InviteCodeUses()
      inviteCodeUse.code = inviteCode
      inviteCodeUse.usedBy = did
      inviteCodeUse.usedAt = new Date().toISOString()
      await db.db.getRepository(InviteCodeUses).insert(inviteCodeUse)
    }

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
