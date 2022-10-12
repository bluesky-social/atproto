import { sql } from 'kysely'
import { InvalidRequestError } from '@adxp/xrpc-server'
import { Repo } from '@adxp/repo'
import { PlcClient } from '@adxp/plc'
import { Server } from '../../../lexicon'
import * as locals from '../../../locals'

export default function (server: Server) {
  server.com.atproto.getAccountsConfig((_params, _input, _req, res) => {
    const cfg = locals.config(res)

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

  server.com.atproto.getAccount(() => {
    // TODO
    return { encoding: '', body: {} }
  })

  server.com.atproto.createAccount(async (_params, input, _req, res) => {
    const { email, username, password, inviteCode } = input.body
    const { db, blockstore, auth, config, keypair, logger } = locals.get(res)
    const { ref } = db.db.dynamic

    if (config.inviteRequired) {
      if (!inviteCode) {
        return {
          status: 400,
          error: 'InvalidInviteCode',
          message: 'No invite code provided',
        }
      }
      const found = await db.db
        .selectFrom('invite_code as invite')
        .leftJoin('invite_code_use as code_use', 'invite.code', 'code_use.code')
        .where('invite.code', '=', inviteCode)
        .groupBy('invite.code')
        .select([
          'invite.disabled as disabled',
          'invite.availableUses as availableUses',
          sql<number>`count(${ref('code_use.usedBy')})`.as('useCount'),
        ])
        .executeTakeFirst()
      if (!found || found.disabled || found.useCount >= found.availableUses) {
        logger.info({ username, email, inviteCode }, 'invalid invite code')
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

    // verify username and email are available.

    // @TODO consider pushing this to the db, and checking for a
    // uniqueness error during registerUser(). Main blocker to doing
    // that now is that we need to create a did prior to registration.

    const foundUsername = await db.getUser(username)
    if (foundUsername !== null) {
      throw new InvalidRequestError(`Username already taken: ${username}`)
    }

    const foundEmail = await db.getUserByEmail(email)
    if (foundEmail !== null) {
      throw new InvalidRequestError(`Email already taken: ${email}`)
    }

    const plcClient = new PlcClient(config.didPlcUrl)
    let did: string
    try {
      did = await plcClient.createDid(
        keypair,
        keypair.did(),
        username,
        config.origin,
      )
    } catch (err) {
      logger.error(
        { didKey: keypair.did(), username },
        'failed to create did:plc',
      )
      throw err
    }

    await db.registerUser(email, username, did, password)

    // @TODO this should be transactional to ensure no double use
    if (config.inviteRequired && inviteCode) {
      const codeUse = {
        code: inviteCode,
        usedBy: did,
        usedAt: new Date().toISOString(),
      }
      await db.db.insertInto('invite_code_use').values(codeUse).execute()
    }

    const authStore = locals.getAuthstore(res, did)
    const repo = await Repo.create(blockstore, did, authStore)

    // @TODO transactionalize this
    await db.db
      .insertInto('repo_root')
      .values({
        did: did,
        root: repo.cid.toString(),
        indexedAt: new Date().toISOString(),
      })
      .execute()

    if (isTestUser && config.testNameRegistry) {
      config.testNameRegistry[username] = did
    }

    const jwt = auth.createToken(did)
    return { encoding: 'application/json', body: { jwt, username, did } }
  })

  server.com.atproto.deleteAccount(() => {
    // TODO
    return { encoding: '', body: {} }
  })
}
