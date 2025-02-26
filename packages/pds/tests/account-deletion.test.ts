import { EventEmitter, once } from 'node:events'
import { Selectable } from 'kysely'
import Mail from 'nodemailer/lib/mailer'
import { AtpAgent } from '@atproto/api'
import { fileExists } from '@atproto/common'
import { SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import { BlobNotFoundError } from '@atproto/repo'
import { AppContext } from '../src'
import {
  Account,
  AppPassword,
  EmailToken,
  RefreshToken,
  RepoRoot,
} from '../src/account-manager/db'
import { ServerMailer } from '../src/mailer'
import { RepoSeq } from '../src/sequencer/db'
import basicSeed from './seeds/basic'

describe('account deletion', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient

  let ctx: AppContext
  let mailer: ServerMailer
  let initialDbContents: DbContents
  let updatedDbContents: DbContents
  const mailCatcher = new EventEmitter()
  let _origSendMail

  // chose carol because she has blobs
  let carol

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'account_deletion',
    })
    // @ts-expect-error Error due to circular dependency with the dev-env package
    ctx = network.pds.ctx
    mailer = ctx.mailer
    agent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    carol = sc.accounts[sc.dids.carol]

    // Catch emails for use in tests
    _origSendMail = mailer.transporter.sendMail
    mailer.transporter.sendMail = async (opts) => {
      const result = await _origSendMail.call(mailer.transporter, opts)
      mailCatcher.emit('mail', opts)
      return result
    }

    initialDbContents = await getDbContents(ctx)
  })

  afterAll(async () => {
    mailer.transporter.sendMail = _origSendMail
    await network.close()
  })

  const getMailFrom = async (promise): Promise<Mail.Options> => {
    const result = await Promise.all([once(mailCatcher, 'mail'), promise])
    return result[0][0]
  }

  const getTokenFromMail = (mail: Mail.Options) =>
    mail.html?.toString().match(/>([a-z0-9]{5}-[a-z0-9]{5})</i)?.[1]

  let token

  it('requests account deletion', async () => {
    const mail = await getMailFrom(
      agent.api.com.atproto.server.requestAccountDelete(undefined, {
        headers: sc.getHeaders(carol.did),
      }),
    )

    expect(mail.to).toEqual(carol.email)
    expect(mail.html).toContain('To permanently delete your account')

    token = getTokenFromMail(mail)
    if (!token) {
      return expect(token).toBeDefined()
    }
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
    const attempt = agent.api.com.atproto.server.deleteAccount({
      token,
      did: carol.did,
      password: 'bad-pass',
    })
    await expect(attempt).rejects.toThrow('Invalid did or password')
  })

  it('deletes account with a valid token & password', async () => {
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
    const eve = await sc.createAccount('eve', {
      handle: 'eve.test',
      email: 'eve@test.com',
      password: 'eve-test',
    })

    const mail = await getMailFrom(
      agent.api.com.atproto.server.requestAccountDelete(undefined, {
        headers: sc.getHeaders(eve.did),
      }),
    )

    const token = getTokenFromMail(mail)
    if (!token) {
      return expect(token).toBeDefined()
    }
    await agent.api.com.atproto.server.deleteAccount({
      token,
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
