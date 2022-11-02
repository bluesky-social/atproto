import { InvalidRequestError } from '@atproto/xrpc-server'
import { RepoStructure } from '@atproto/repo'
import { PlcClient } from '@atproto/plc'
import { Server } from '../../../lexicon'
import * as locals from '../../../locals'
import { countAll } from '../../../db/util'
import { UserAlreadyExistsError } from '../../../db'
import SqlBlockstore from '../../../sql-blockstore'
import { ensureUsernameValid } from './util/username'
import { grantRefreshToken } from './util/auth'
import { AtUri } from '@atproto/uri'
import * as schema from '../../../lexicon/schemas'

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
    const { password, inviteCode, recoveryKey } = input.body
    const { db, auth, config, keypair, logger } = locals.get(res)
    const username = input.body.username.toLowerCase()
    const email = input.body.email.toLowerCase()

    // throws if not
    ensureUsernameValid(username, config.availableUserDomains)

    const now = new Date().toISOString()

    const result = await db.transaction(async (dbTxn) => {
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
      const repo = await RepoStructure.create(blockstore, did, authStore)

      const declaration = {
        $type: 'app.bsky.declaration',
        actorType: 'app.bsky.actorUser',
      }
      const declarationCid = await blockstore.put(declaration)
      const uri = new AtUri(`${did}/${schema.ids.AppBskyDeclaration}/self`)

      await repo
        .stageUpdate({
          action: 'create',
          collection: uri.collection,
          rkey: uri.rkey,
          cid: declarationCid,
        })
        .createCommit(authStore, async (_prev, curr) => {
          await dbTxn.db
            .insertInto('repo_root')
            .values({
              did: did,
              root: curr.toString(),
              indexedAt: now,
            })
            .execute()
          return null
        })

      await dbTxn.indexRecord(uri, declarationCid, declaration, now)

      const access = auth.createAccessToken(did)
      const refresh = auth.createRefreshToken(did)
      await grantRefreshToken(dbTxn, refresh.payload)

      return {
        did,
        declarationCid,
        accessJwt: access.jwt,
        refreshJwt: refresh.jwt,
      }
    })

    return {
      encoding: 'application/json',
      body: {
        username,
        did: result.did,
        accessJwt: result.accessJwt,
        refreshJwt: result.refreshJwt,
        declarationCid: result.declarationCid.toString(),
      },
    }
  })

  server.com.atproto.deleteAccount(() => {
    // TODO
    throw new InvalidRequestError('Not implemented')
  })
}
