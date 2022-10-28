import { InvalidRequestError } from '@atproto/xrpc-server'
import { Repo } from '@atproto/repo'
import { PlcClient } from '@atproto/plc'
import { Server } from '../../../lexicon'
import * as locals from '../../../locals'
import { countAll } from '../../../db/util'
import { UserAlreadyExistsError } from '../../../db'
import SqlBlockstore from '../../../sql-blockstore'

export default function (server: Server) {
  server.com.atproto.getAccountsConfig((_params, _input, _req, res) => {
    const cfg = locals.config(res)

    const availableUserDomains = cfg.availableUserDomains
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
    const { db, auth, config, keypair, logger } = locals.get(res)

    // In order to perform the significant db updates ahead of
    // registering the did, we will use a temp invalid did. Once everything
    // goes well and a fresh did is registered, we'll replace the temp values.
    const now = new Date().toISOString()

    // Validate username

    if (username.startsWith('did:')) {
      throw new InvalidRequestError(
        'Cannot register a username that starts with `did:`',
        'InvalidUsername',
      )
    }

    const supportedUsername = config.availableUserDomains.some((host) =>
      username.toLowerCase().endsWith(host),
    )
    if (!supportedUsername) {
      throw new InvalidRequestError(
        'Not a supported username domain',
        'InvalidUsername',
      )
    }

    const did = await db.transaction(async (dbTxn) => {
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
      }

      // Pre-register user before going out to PLC to get a real did

      try {
        await dbTxn.registerUser(email, username, password)
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
          config.publicUrl,
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

      await dbTxn.registerUserDid(username, did)
      if (config.inviteRequired && inviteCode) {
        await dbTxn.db
          .insertInto('invite_code_use')
          .values({
            code: inviteCode,
            usedBy: did,
            usedAt: now,
          })
          .execute()
      }

      // Setup repo root
      const authStore = locals.getAuthstore(res, did)
      const blockstore = new SqlBlockstore(dbTxn, did, now)
      const repo = await Repo.create(blockstore, did, authStore)

      await dbTxn.db
        .insertInto('repo_root')
        .values({
          did: did,
          root: repo.cid.toString(),
          indexedAt: now,
        })
        .execute()

      return did
    })

    const jwt = auth.createToken(did)
    return { encoding: 'application/json', body: { jwt, username, did } }
  })

  server.com.atproto.deleteAccount(() => {
    // TODO
    throw new InvalidRequestError('Not implemented')
  })
}
