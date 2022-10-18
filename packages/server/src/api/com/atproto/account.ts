import { sql } from 'kysely'
import { randomBytes } from '@adxp/crypto'
import { InvalidRequestError } from '@adxp/xrpc-server'
import { Repo } from '@adxp/repo'
import { PlcClient } from '@adxp/plc'
import * as uint8arrays from 'uint8arrays'
import { Server } from '../../../lexicon'
import * as locals from '../../../locals'
import { countAll } from '../../../db/util'

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

    // In order to perform the significant db updates ahead of
    // registering the did, we will use a temp invalid did. Once everything
    // goes well and a fresh did is registered, we'll replace the temp values.
    const tempDid = uint8arrays.toString(randomBytes(16), 'base32') // TODO handle replacement
    const now = new Date().toISOString()

    const { did, isTestUser } = await db.transaction(async (dbTxn) => {
      if (config.inviteRequired) {
        if (!inviteCode) {
          throw new InvalidRequestError(
            'No invite code provided',
            'InvalidInviteCode',
          )
        }

        const insertedCodeUse = await dbTxn.db
          .insertInto('invite_code_use')
          .columns(['code', 'usedBy', 'usedAt'])
          .expression(
            dbTxn.db
              .selectFrom(
                sql`(values (${inviteCode}, ${tempDid}, ${now}))`.as('v'),
              )
              .selectAll()
              .whereExists(validInviteQuery(dbTxn, inviteCode)),
          )
          .returning('code')
          .executeTakeFirst()

        if (!insertedCodeUse) {
          logger.info({ username, email, inviteCode }, 'invalid invite code')
          throw new InvalidRequestError(
            'Provided invite code not available',
            'InvalidInviteCode',
          )
        }
      }

      if (username.startsWith('did:')) {
        throw new InvalidRequestError(
          'Cannot register a username that starts with `did:`',
          'InvalidUsername',
        )
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

      const foundUsername = await dbTxn.getUser(username)
      if (foundUsername !== null) {
        throw new InvalidRequestError(`Username already taken: ${username}`)
      }

      const foundEmail = await dbTxn.getUserByEmail(email)
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

      await dbTxn.registerUser(email, username, did, password)

      const authStore = locals.getAuthstore(res, did)
      const repo = await Repo.create(blockstore, did, authStore)

      // @TODO transactionalize this
      await dbTxn.db
        .insertInto('repo_root')
        .values({
          did: did,
          root: repo.cid.toString(),
          indexedAt: now,
        })
        .execute()

      return { did, isTestUser }
    })

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

const validInviteQuery = (db, inviteCode: string) => {
  const { ref } = db.db.dynamic
  return db.db
    .selectFrom('invite_code as invite')
    .selectAll()
    .where('invite.code', '=', inviteCode)
    .where('invite.disabled', '=', 0)
    .where(
      'invite.availableUses',
      '>',
      db.db
        .selectFrom('invite_code_use as code_use')
        .whereRef('code_use.code', '=', ref('invite.code'))
        .select(countAll.as('count')),
    )
}
