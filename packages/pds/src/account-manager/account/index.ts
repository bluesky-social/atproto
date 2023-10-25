import { CID } from 'multiformats/cid'
import { randomStr } from '@atproto/crypto'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { MINUTE, lessThanAgoMs } from '@atproto/common'
import { INVALID_HANDLE } from '@atproto/syntax'
import { dbLogger as log } from '../../logger'
import * as scrypt from './scrypt'
import { countAll, notSoftDeletedClause } from '../../db/util'
import { AppPassword } from '../../lexicon/types/com/atproto/server/createAppPassword'
import { getRandomToken } from '../../api/com/atproto/server/util'
import { ServiceDb, AccountEntry, EmailTokenPurpose } from '../../service-db'
import { TimeCidKeyset } from '../../db/pagination'
import { StatusAttr } from '@atproto/api/src/client/types/com/atproto/admin/defs'
import { AccountView } from '../../lexicon/types/com/atproto/admin/defs'

export class AccountService {
  constructor(public db: ServiceDb) {}

  // Repo exists and is not taken-down
  async isRepoAvailable(did: string) {
    const found = await this.db.db
      .selectFrom('account')
      .innerJoin('repo_root', 'repo_root.did', 'account.did')
      .where('account.did', '=', did)
      .where('account.takedownId', 'is', null)
      .select('account.did')
      .executeTakeFirst()
    return found !== undefined
  }

  async getDidForActor(
    handleOrDid: string,
    includeSoftDeleted = false,
  ): Promise<string | null> {
    if (handleOrDid.startsWith('did:')) {
      if (includeSoftDeleted) {
        return handleOrDid
      }
      const available = await this.isRepoAvailable(handleOrDid)
      return available ? handleOrDid : null
    }
    const { ref } = this.db.db.dynamic
    const found = await this.db.db
      .selectFrom('account')
      .if(!includeSoftDeleted, (qb) =>
        qb.where(notSoftDeletedClause(ref('account'))),
      )
      .where('handle', '=', handleOrDid)
      .select('did')
      .executeTakeFirst()
    return found ? found.did : null
  }

  async registerUser(opts: {
    email: string
    handle: string
    did: string
    passwordScrypt: string
  }) {
    this.db.assertTransaction()
    const { email, handle, did, passwordScrypt } = opts
    const registered = await this.db.db
      .insertInto('account')
      .values({
        email: email.toLowerCase(),
        did,
        handle,
        passwordScrypt,
        createdAt: new Date().toISOString(),
      })
      .onConflict((oc) => oc.doNothing())
      .returning('did')
      .executeTakeFirst()

    if (!registered) {
      throw new UserAlreadyExistsError()
    }
    log.info({ handle, email, did }, 'registered user')
  }

  async updateUserPassword(did: string, password: string) {
    const passwordScrypt = await scrypt.genSaltAndHash(password)
    await this.db.db
      .updateTable('account')
      .set({ passwordScrypt })
      .where('did', '=', did)
      .execute()
  }

  async deleteAppPassword(did: string, name: string) {
    await this.db.db
      .deleteFrom('app_password')
      .where('did', '=', did)
      .where('name', '=', name)
      .execute()
  }

  async listAppPasswords(
    did: string,
  ): Promise<{ name: string; createdAt: string }[]> {
    return this.db.db
      .selectFrom('app_password')
      .select(['name', 'createdAt'])
      .where('did', '=', did)
      .execute()
  }

  async getAccountTakedownStatus(did: string): Promise<StatusAttr | null> {
    const res = await this.db.db
      .selectFrom('account')
      .select('takedownId')
      .where('did', '=', did)
      .executeTakeFirst()
    if (!res) return null
    return res.takedownId
      ? { applied: true, ref: res.takedownId }
      : { applied: false }
  }

  async updateAccountTakedownStatus(did: string, takedown: StatusAttr) {
    const takedownId = takedown.applied
      ? takedown.ref ?? new Date().toISOString()
      : null
    await this.db.db
      .updateTable('account')
      .set({ takedownId })
      .where('did', '=', did)
      .executeTakeFirst()
  }

  async deleteAccount(did: string): Promise<void> {
    // Not done in transaction because it would be too long, prone to contention.
    // Also, this can safely be run multiple times if it fails.
    await this.db.db.deleteFrom('repo_root').where('did', '=', did).execute()
    await this.db.db.deleteFrom('email_token').where('did', '=', did).execute()
    await this.db.db
      .deleteFrom('refresh_token')
      .where('did', '=', did)
      .execute()
    await this.db.db
      .deleteFrom('account')
      .where('account.did', '=', did)
      .execute()
  }

  async adminView(did: string): Promise<AccountView | null> {
    const accountQb = this.db.db
      .selectFrom('account')
      .where('account.did', '=', did)
      .select([
        'account.did',
        'account.handle',
        'account.email',
        'account.invitesDisabled',
        'account.createdAt as indexedAt',
      ])

    const [account, invites, invitedBy] = await Promise.all([
      accountQb.executeTakeFirst(),
      this.getAccountInviteCodes(did),
      this.getInvitedByForAccounts([did]),
    ])

    if (!account) return null

    return {
      ...account,
      handle: account?.handle ?? INVALID_HANDLE,
      invitesDisabled: account.invitesDisabled === 1,
      invites,
      invitedBy: invitedBy[did],
    }
  }

  selectInviteCodesQb() {
    const ref = this.db.db.dynamic.ref
    const builder = this.db.db
      .selectFrom('invite_code')
      .select([
        'invite_code.code as code',
        'invite_code.availableUses as available',
        'invite_code.disabled as disabled',
        'invite_code.forAccount as forAccount',
        'invite_code.createdBy as createdBy',
        'invite_code.createdAt as createdAt',
        this.db.db
          .selectFrom('invite_code_use')
          .select(countAll.as('count'))
          .whereRef('invite_code_use.code', '=', ref('invite_code.code'))
          .as('uses'),
      ])
    return this.db.db.selectFrom(builder.as('codes')).selectAll()
  }

  async getInviteCodesUses(
    codes: string[],
  ): Promise<Record<string, CodeUse[]>> {
    const uses: Record<string, CodeUse[]> = {}
    if (codes.length > 0) {
      const usesRes = await this.db.db
        .selectFrom('invite_code_use')
        .where('code', 'in', codes)
        .orderBy('usedAt', 'desc')
        .selectAll()
        .execute()
      for (const use of usesRes) {
        const { code, usedBy, usedAt } = use
        uses[code] ??= []
        uses[code].push({ usedBy, usedAt })
      }
    }
    return uses
  }

  async getAccountInviteCodes(did: string): Promise<CodeDetail[]> {
    const res = await this.selectInviteCodesQb()
      .where('forAccount', '=', did)
      .execute()
    const codes = res.map((row) => row.code)
    const uses = await this.getInviteCodesUses(codes)
    return res.map((row) => ({
      ...row,
      uses: uses[row.code] ?? [],
      disabled: row.disabled === 1,
    }))
  }

  async getInvitedByForAccounts(
    dids: string[],
  ): Promise<Record<string, CodeDetail>> {
    if (dids.length < 1) return {}
    const codeDetailsRes = await this.selectInviteCodesQb()
      .where('code', 'in', (qb) =>
        qb
          .selectFrom('invite_code_use')
          .where('usedBy', 'in', dids)
          .select('code')
          .distinct(),
      )
      .execute()
    const uses = await this.getInviteCodesUses(
      codeDetailsRes.map((row) => row.code),
    )
    const codeDetails = codeDetailsRes.map((row) => ({
      ...row,
      uses: uses[row.code] ?? [],
      disabled: row.disabled === 1,
    }))
    return codeDetails.reduce((acc, cur) => {
      for (const use of cur.uses) {
        acc[use.usedBy] = cur
      }
      return acc
    }, {} as Record<string, CodeDetail>)
  }

  async deleteEmailToken(did: string, purpose: EmailTokenPurpose) {
    await this.db.db
      .deleteFrom('email_token')
      .where('did', '=', did)
      .where('purpose', '=', purpose)
      .executeTakeFirst()
  }

  async assertValidToken(
    did: string,
    purpose: EmailTokenPurpose,
    token: string,
    expirationLen = 15 * MINUTE,
  ) {
    const res = await this.db.db
      .selectFrom('email_token')
      .selectAll()
      .where('purpose', '=', purpose)
      .where('did', '=', did)
      .where('token', '=', token.toUpperCase())
      .executeTakeFirst()
    if (!res) {
      throw new InvalidRequestError('Token is invalid', 'InvalidToken')
    }
    const expired = !lessThanAgoMs(new Date(res.requestedAt), expirationLen)
    if (expired) {
      throw new InvalidRequestError('Token is expired', 'ExpiredToken')
    }
  }

  async assertValidTokenAndFindDid(
    purpose: EmailTokenPurpose,
    token: string,
    expirationLen = 15 * MINUTE,
  ): Promise<string> {
    const res = await this.db.db
      .selectFrom('email_token')
      .selectAll()
      .where('purpose', '=', purpose)
      .where('token', '=', token.toUpperCase())
      .executeTakeFirst()
    if (!res) {
      throw new InvalidRequestError('Token is invalid', 'InvalidToken')
    }
    const expired = !lessThanAgoMs(new Date(res.requestedAt), expirationLen)
    if (expired) {
      throw new InvalidRequestError('Token is expired', 'ExpiredToken')
    }
    return res.did
  }

  async takedownActor(info: { takedownId: string; did: string }) {
    const { takedownId, did } = info
    await this.db.db
      .updateTable('account')
      .set({ takedownId })
      .where('did', '=', did)
      .execute()
  }

  async reverseActorTakedown(info: { did: string }) {
    await this.db.db
      .updateTable('account')
      .set({ takedownId: null })
      .where('did', '=', info.did)
      .execute()
  }
}

export type CodeDetail = {
  code: string
  available: number
  disabled: boolean
  forAccount: string
  createdBy: string
  createdAt: string
  uses: CodeUse[]
}

type CodeUse = {
  usedBy: string
  usedAt: string
}

export class UserAlreadyExistsError extends Error {}

export class ListKeyset extends TimeCidKeyset<{
  indexedAt: string
  handle: string // handles are treated identically to cids in TimeCidKeyset
}> {
  labelResult(result: { indexedAt: string; handle: string }) {
    return { primary: result.indexedAt, secondary: result.handle }
  }
}

export type HandleSequenceToken = { did: string; handle: string }
