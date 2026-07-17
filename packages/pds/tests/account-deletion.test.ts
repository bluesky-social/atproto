import { jest } from '@jest/globals'
import type { Selectable } from 'kysely'
import type { AtpAgent } from '@atproto/api'
import { fileExists } from '@atproto/common'
import {
  type Account as SeedAccount,
  type SeedClient,
  TestNetworkNoAppView,
} from '@atproto/dev-env'
import { BlobNotFoundError } from '@atproto/repo'
import type {
  Account,
  AppPassword,
  EmailToken,
  RefreshToken,
  RepoRoot,
} from '../src/account-manager/db/index.js'
import type { AppContext } from '../src/index.js'
import type { RepoSeq } from '../src/sequencer/db/index.js'
import basicSeed from './seeds/basic.js'

describe('account deletion', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient

  let ctx: AppContext
  let initialDbContents: DbContents
  let updatedDbContents: DbContents

  // chose carol because she has blobs
  let carol: SeedAccount
  let token: string
  let sendMailMock: jest.SpiedFunction<
    AppContext['mailer']['transporter']['sendMail']
  >

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'account_deletion',
    })
    ctx = network.pds.ctx
    agent = network.pds.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc)
    carol = sc.accounts[sc.dids.carol]

    initialDbContents = await getDbContents(ctx)

    sendMailMock = jest
      .spyOn(ctx.mailer.transporter, 'sendMail')
      .mockImplementation(async () => {})
  })

  beforeEach(() => {
    // Catch-all: never actually send, but keep recording calls for assertions.
    sendMailMock.mockClear()
  })

  afterAll(async () => {
    await network?.close()
  })

  it('requests account deletion', async () => {
    using sendAccountDeleteMock = jest.spyOn(ctx.mailer, 'sendAccountDelete')

    await agent.api.com.atproto.server.requestAccountDelete(undefined, {
      headers: sc.getHeaders(carol.did),
    })

    expect(sendAccountDeleteMock).toHaveBeenCalledTimes(1)
    expect(sendMailMock).toHaveBeenCalledTimes(1)

    const [params] = sendAccountDeleteMock.mock.lastCall!
    expect(params).toEqual({
      token: expect.any(String),
    })

    const [mail] = sendMailMock.mock.lastCall!
    expect(mail.to).toEqual(carol.email)
    expect(mail.subject).toBe('Account Deletion Requested')
    expect(mail.html).toContain('To permanently delete your account')

    token = params.token
  })

  it('fails account deletion with a bad token', async () => {
    const attempt = agent.api.com.atproto.server.deleteAccount({
      token: '123456',
      did: carol.did,
      password: carol.password,
    })
    await expect(attempt).rejects.toThrow('Token is invalid')
  })

  it('fails account deletion with a bad password', async () => {
    expect(token).toBeDefined()
    const attempt = agent.api.com.atproto.server.deleteAccount({
      token,
      did: carol.did,
      password: 'bad-pass',
    })
    await expect(attempt).rejects.toThrow('Invalid did or password')
  })

  it('deletes account with a valid token & password', async () => {
    expect(token).toBeDefined()
    // Perform account deletion, including when the account is already "taken down"
    await agent.api.com.atproto.admin.updateSubjectStatus(
      {
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: carol.did,
        },
        takedown: { applied: true },
      },
      {
        encoding: 'application/json',
        headers: network.pds.adminAuthHeaders(),
      },
    )
    await agent.api.com.atproto.server.deleteAccount({
      token,
      did: carol.did,
      password: carol.password,
    })
    await network.processAll() // Finish background hard-deletions
  })

  it('no longer lets the user log in', async () => {
    const attempt = agent.api.com.atproto.server.createSession({
      identifier: carol.handle,
      password: carol.password,
    })
    await expect(attempt).rejects.toThrow('Invalid identifier or password')
  })

  it('no longer store the user account or repo', async () => {
    updatedDbContents = await getDbContents(ctx)
    expect(updatedDbContents.repoRoots).toEqual(
      initialDbContents.repoRoots.filter((row) => row.did !== carol.did),
    )
    expect(updatedDbContents.userAccounts).toEqual(
      initialDbContents.userAccounts.filter((row) => row.did !== carol.did),
    )
    // check we didn't touch other user seqs
    expect(
      updatedDbContents.repoSeqs.filter((row) => row.did !== carol.did),
    ).toEqual(initialDbContents.repoSeqs.filter((row) => row.did !== carol.did))
    // check all seqs for this did are gone, except for the tombstone & account events
    expect(
      updatedDbContents.repoSeqs
        .filter((row) => row.did === carol.did)
        .every((row) => row.eventType === 'account'),
    ).toBe(true)
    // check we do have a account (deletion) event for this did
    expect(
      updatedDbContents.repoSeqs.filter(
        (row) => row.did === carol.did && row.eventType === 'account',
      ).length,
    ).toEqual(1)
    expect(updatedDbContents.appPasswords).toEqual(
      initialDbContents.appPasswords.filter((row) => row.did !== carol.did),
    )
    expect(updatedDbContents.emailTokens).toEqual(
      initialDbContents.emailTokens.filter((row) => row.did !== carol.did),
    )
    expect(updatedDbContents.refreshTokens).toEqual(
      initialDbContents.refreshTokens.filter((row) => row.did !== carol.did),
    )
  })

  it('deletes the users actor store', async () => {
    const carolLoc = await network.pds.ctx.actorStore.getLocation(carol.did)
    const dbExists = await fileExists(carolLoc.dbLocation)
    expect(dbExists).toBe(false)
    const walExists = await fileExists(`${carolLoc.dbLocation}-wal`)
    expect(walExists).toBe(false)
    const shmExists = await fileExists(`${carolLoc.dbLocation}-shm`)
    expect(shmExists).toBe(false)
  })

  it('deletes relevant blobs', async () => {
    const imgs = sc.posts[carol.did][0].images
    const first = imgs[0].image.ref
    const second = imgs[1].image.ref
    const blobstore = network.pds.ctx.blobstore(carol.did)
    const attempt1 = blobstore.getBytes(first)
    await expect(attempt1).rejects.toThrow(BlobNotFoundError)
    const attempt2 = blobstore.getBytes(second)
    await expect(attempt2).rejects.toThrow(BlobNotFoundError)
  })

  it('maintains blobs from other actors', async () => {
    const bobBlobstore = network.pds.ctx.blobstore(sc.dids.bob)
    const [img] = sc.replies[sc.dids.bob][0].images
    const attempt = bobBlobstore.getBytes(img.image.ref)
    await expect(attempt).resolves.toBeDefined()
  })

  it('can delete an empty user', async () => {
    using sendAccountDeleteMock = jest.spyOn(ctx.mailer, 'sendAccountDelete')

    const eve = await sc.createAccount('eve', {
      handle: 'eve.test',
      email: 'eve@test.com',
      password: 'eve-test',
    })

    await agent.api.com.atproto.server.requestAccountDelete(undefined, {
      headers: sc.getHeaders(eve.did),
    })

    expect(sendAccountDeleteMock).toHaveBeenCalledTimes(1)
    const [params] = sendAccountDeleteMock.mock.lastCall!

    await agent.api.com.atproto.server.deleteAccount({
      token: params.token,
      did: eve.did,
      password: eve.password,
    })
  })

  it('can be performed by an administrator.', async () => {
    const ferris = await sc.createAccount('ferris', {
      handle: 'ferris.test',
      email: 'ferris@test.com',
      password: 'ferris-test',
    })

    const tryUnauthed = agent.api.com.atproto.admin.deleteAccount({
      did: ferris.did,
    })
    await expect(tryUnauthed).rejects.toThrow('Authentication Required')

    const { data: acct } = await agent.api.com.atproto.admin.getAccountInfo(
      { did: ferris.did },
      { headers: network.pds.adminAuthHeaders() },
    )
    expect(acct.did).toBe(ferris.did)

    await agent.api.com.atproto.admin.deleteAccount(
      { did: ferris.did },
      {
        headers: network.pds.adminAuthHeaders(),
        encoding: 'application/json',
      },
    )

    const tryGetAccountInfo = agent.api.com.atproto.admin.getAccountInfo(
      { did: ferris.did },
      { headers: network.pds.adminAuthHeaders() },
    )
    await expect(tryGetAccountInfo).rejects.toThrow('Account not found')
  })
})

type DbContents = {
  repoRoots: RepoRoot[]
  userAccounts: Selectable<Account>[]
  appPasswords: AppPassword[]
  emailTokens: EmailToken[]
  refreshTokens: RefreshToken[]
  repoSeqs: Selectable<RepoSeq>[]
}

const getDbContents = async (ctx: AppContext): Promise<DbContents> => {
  const { sequencer, accountManager } = ctx
  const db = accountManager.db
  const [
    repoRoots,
    userAccounts,
    appPasswords,
    emailTokens,
    refreshTokens,
    repoSeqs,
  ] = await Promise.all([
    db.db.selectFrom('repo_root').orderBy('did').selectAll().execute(),
    db.db.selectFrom('account').orderBy('did').selectAll().execute(),
    db.db
      .selectFrom('app_password')
      .orderBy('did')
      .orderBy('name')
      .selectAll()
      .execute(),
    db.db.selectFrom('email_token').orderBy('token').selectAll().execute(),
    db.db.selectFrom('refresh_token').orderBy('id').selectAll().execute(),
    sequencer.db.db.selectFrom('repo_seq').orderBy('seq').selectAll().execute(),
  ])

  return {
    repoRoots,
    userAccounts,
    appPasswords,
    emailTokens,
    refreshTokens,
    repoSeqs,
  }
}
