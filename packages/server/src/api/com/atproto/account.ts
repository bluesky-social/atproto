import assert from 'assert'
import { randomBytes } from '@atproto/crypto'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Repo } from '@atproto/repo'
import { PlcClient } from '@atproto/plc'
import * as uint8arrays from 'uint8arrays'
import { Server } from '../../../lexicon'
import * as locals from '../../../locals'
import { countAll } from '../../../db/util'
import { UserAlreadyExistsError } from '../../../db'

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
    throw new InvalidRequestError('Not implemented')
  })

  server.com.atproto.createAccount(async (_params, input, _req, res) => {
    const { email, username, password, inviteCode, recoveryKey } = input.body
    const { db, blockstore, auth, config, keypair, logger } = locals.get(res)

    // In order to perform the significant db updates ahead of
    // registering the did, we will use a temp invalid did. Once everything
    // goes well and a fresh did is registered, we'll replace the temp values.
    const tempDid = uint8arrays.toString(randomBytes(16), 'base32')
    const now = new Date().toISOString()

    // Validate username

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

    const { did } = await db.transaction(async (dbTxn) => {
      if (config.inviteRequired) {
        if (!inviteCode) {
          throw new InvalidRequestError(
            'No invite code provided',
            'InvalidInviteCode',
          )
        }

        const invite = await dbTxn.db
          .selectFrom('invite_code')
          .selectAll()
          .where('code', '=', inviteCode)
          // Lock invite code to avoid duplicate use
          .if(dbTxn.dialect === 'pg', (qb) => qb.forUpdate())
          .executeTakeFirst()

        const { useCount } = await dbTxn.db
          .selectFrom('invite_code_use')
          .select(countAll.as('useCount'))
          .where('code', '=', inviteCode)
          .executeTakeFirstOrThrow()

        if (!invite || invite.disabled || invite.availableUses <= useCount) {
          logger.info({ username, email, inviteCode }, 'invalid invite code')
          throw new InvalidRequestError(
            'Provided invite code not available',
            'InvalidInviteCode',
          )
        }

        await dbTxn.db
          .insertInto('invite_code_use')
          .values({
            code: inviteCode,
            usedBy: tempDid,
            usedAt: now,
          })
          .execute()
      }

      // Pre-register user before going out to PLC to get a real did

      try {
        await dbTxn.preRegisterUser(email, username, tempDid, password)
      } catch (err) {
        if (err instanceof UserAlreadyExistsError) {
          if ((await dbTxn.getUser(username)) !== null) {
            throw new InvalidRequestError(`Username already taken: ${username}`)
          } else if ((await dbTxn.getUserByEmail(email)) !== null) {
            throw new InvalidRequestError(`Email already taken: ${email}`)
          } else {
            throw new InvalidRequestError('Username or email already taken')
          }
        }
        throw err
      }

      // Generate a real did with PLC

      const plcClient = new PlcClient(config.didPlcUrl)
      let did: string
      try {
        did = await plcClient.createDid(
          keypair,
          recoveryKey || config.recoveryKey,
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

      // Now that we have a real did, we now replace the tempDid in user and invite_code_use
      // tables, and setup the repo root. These all _should_ succeed under typical conditions.
      // It's about as good as we're gonna get transactionally, given that we rely on PLC here to assign the did.

      await dbTxn.postRegisterUser(tempDid, did)
      if (config.inviteRequired) {
        const updated = await dbTxn.db
          .updateTable('invite_code_use')
          .where('usedBy', '=', tempDid)
          .set({ usedBy: did })
          .executeTakeFirst()
        assert(
          Number(updated.numUpdatedRows) === 1,
          'Should act on exactly one invite code use',
        )
      }

      // Setup repo root
      const authStore = locals.getAuthstore(res, did)
      const repo = await Repo.create(blockstore, did, authStore)

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
    throw new InvalidRequestError('Not implemented')
  })
}
