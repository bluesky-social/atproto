import { TestNetworkNoAppView, SeedClient } from '@atproto/dev-env'
import { once, EventEmitter } from 'events'
import { Selectable } from 'kysely'
import Mail from 'nodemailer/lib/mailer'
import AtpAgent from '@atproto/api'
import basicSeed from './seeds/basic'
import { Database } from '../src'
import { ServerMailer } from '../src/mailer'
import { BlobNotFoundError, BlobStore } from '@atproto/repo'
import { RepoRoot } from '../src/db/tables/repo-root'
import { UserAccount } from '../src/db/tables/user-account'
import { IpldBlock } from '../src/db/tables/ipld-block'
import { RepoBlob } from '../src/db/tables/repo-blob'
import { Blob } from '../src/db/tables/blob'
import { Record } from '../src/db/tables/record'
import { RepoSeq } from '../src/db/tables/repo-seq'

describe('account deletion', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient

  let mailer: ServerMailer
  let db: Database
  let initialDbContents: DbContents
  let updatedDbContents: DbContents
  let blobstore: BlobStore
  const mailCatcher = new EventEmitter()
  let _origSendMail

  // chose carol because she has blobs
  let carol

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'account_deletion',
    })
    mailer = network.pds.ctx.mailer
    db = network.pds.ctx.db
    blobstore = network.pds.ctx.blobstore
    agent = new AtpAgent({ service: network.pds.url })
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

    initialDbContents = await getDbContents(db)
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
    expect(mail.html).toContain('Delete your Bluesky account')

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
    // Perform account deletion, including when there's an existing takedown on the account
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
    updatedDbContents = await getDbContents(db)
    expect(updatedDbContents.roots).toEqual(
      initialDbContents.roots.filter((row) => row.did !== carol.did),
    )
    expect(updatedDbContents.users).toEqual(
      initialDbContents.users.filter((row) => row.did !== carol.did),
    )
    expect(updatedDbContents.blocks).toEqual(
      initialDbContents.blocks.filter((row) => row.creator !== carol.did),
    )
    // check all seqs for this did are gone, except for the tombstone
    expect(
      updatedDbContents.seqs.filter((row) => row.eventType !== 'tombstone'),
    ).toEqual(initialDbContents.seqs.filter((row) => row.did !== carol.did))
    // check we do have a tombstone for this did
    expect(
      updatedDbContents.seqs.filter(
        (row) => row.did === carol.did && row.eventType === 'tombstone',
      ).length,
    ).toEqual(1)

    expect(updatedDbContents.records).toEqual(
      initialDbContents.records.filter((row) => row.did !== carol.did),
    )
  })

  it('deletes relevant blobs', async () => {
    const imgs = sc.posts[carol.did][0].images
    // carols first blob is used by other accounts
    const first = imgs[0].image.ref
    // carols second blob is used by only her
    const second = imgs[1].image.ref
    const got = await blobstore.getBytes(first)
    expect(got).toBeDefined()
    const attempt = blobstore.getBytes(second)
    await expect(attempt).rejects.toThrow(BlobNotFoundError)

    expect(updatedDbContents.repoBlobs).toEqual(
      initialDbContents.repoBlobs.filter((row) => row.did !== carol.did),
    )
    expect(updatedDbContents.blobs).toEqual(
      initialDbContents.blobs.filter((row) => row.creator !== carol.did),
    )
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
})

type DbContents = {
  roots: RepoRoot[]
  users: Selectable<UserAccount>[]
  blocks: IpldBlock[]
  seqs: Selectable<RepoSeq>[]
  records: Record[]
  repoBlobs: RepoBlob[]
  blobs: Blob[]
}

const getDbContents = async (db: Database): Promise<DbContents> => {
  const [roots, users, blocks, seqs, records, repoBlobs, blobs] =
    await Promise.all([
      db.db.selectFrom('repo_root').orderBy('did').selectAll().execute(),
      db.db.selectFrom('user_account').orderBy('did').selectAll().execute(),
      db.db
        .selectFrom('ipld_block')
        .orderBy('creator')
        .orderBy('cid')
        .selectAll()
        .execute(),
      db.db.selectFrom('repo_seq').orderBy('id').selectAll().execute(),
      db.db.selectFrom('record').orderBy('uri').selectAll().execute(),
      db.db
        .selectFrom('repo_blob')
        .orderBy('did')
        .orderBy('cid')
        .selectAll()
        .execute(),
      db.db.selectFrom('blob').orderBy('cid').selectAll().execute(),
    ])

  return {
    roots,
    users,
    blocks,
    seqs,
    records,
    repoBlobs,
    blobs,
  }
}
