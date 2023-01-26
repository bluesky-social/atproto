import { once, EventEmitter } from 'events'
import Mail from 'nodemailer/lib/mailer'
import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
import { SeedClient } from './seeds/client'
import basicSeed from './seeds/basic'
import { Database } from '../src'
import * as util from './_util'
import { ServerMailer } from '../src/mailer'
import { BlobNotFoundError, BlobStore } from '@atproto/repo'
import { CID } from 'multiformats/cid'

describe('account deletion', () => {
  let client: AtpServiceClient
  let close: util.CloseFn
  let sc: SeedClient

  let mailer: ServerMailer
  let db: Database
  let blobstore: BlobStore
  const mailCatcher = new EventEmitter()
  let _origSendMail

  // chose carol because she has blobs
  let carol

  beforeAll(async () => {
    const server = await util.runTestServer({
      dbPostgresSchema: 'account_deletion',
    })
    close = server.close
    mailer = server.ctx.mailer
    db = server.ctx.db
    blobstore = server.ctx.blobstore
    client = AtpApi.service(server.url)
    sc = new SeedClient(client)
    await basicSeed(sc, server.ctx.messageQueue)
    carol = sc.accounts[sc.dids.carol]

    // Catch emails for use in tests
    _origSendMail = mailer.transporter.sendMail
    mailer.transporter.sendMail = async (opts) => {
      const result = await _origSendMail.call(mailer.transporter, opts)
      mailCatcher.emit('mail', opts)
      return result
    }
  })

  afterAll(async () => {
    mailer.transporter.sendMail = _origSendMail
    if (close) {
      await close()
    }
  })

  const getMailFrom = async (promise): Promise<Mail.Options> => {
    const result = await Promise.all([once(mailCatcher, 'mail'), promise])
    return result[0][0]
  }

  const getTokenFromMail = (mail: Mail.Options) =>
    mail.html?.toString().match(/>(\d{6})</)?.[1]

  let token

  it('requests account deletion', async () => {
    const mail = await getMailFrom(
      client.com.atproto.account.requestDelete(undefined, {
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
    const attempt = client.com.atproto.account.delete({
      token: '123456',
      handle: carol.handle,
      password: carol.password,
    })
    await expect(attempt).rejects.toThrow('Token is invalid')
  })

  it('fails account deletion with a bad password', async () => {
    const attempt = client.com.atproto.account.delete({
      token,
      handle: carol.handle,
      password: 'bad-pass',
    })
    await expect(attempt).rejects.toThrow('Invalid handle or password')
  })

  it('deletes account with a valid token & password', async () => {
    await client.com.atproto.account.delete({
      token,
      handle: carol.handle,
      password: carol.password,
    })
  })

  it('no longer lets the user log in', async () => {
    const attempt = client.com.atproto.session.create({
      handle: carol.handle,
      password: carol.password,
    })
    await expect(attempt).rejects.toThrow('Invalid handle or password')
  })

  it('no longer store the user account or repo', async () => {
    const [roots, users, blocks] = await Promise.all([
      db.db
        .selectFrom('repo_root')
        .where('did', '=', carol.did)
        .selectAll()
        .execute(),
      db.db
        .selectFrom('user')
        .where('handle', '=', carol.handle)
        .selectAll()
        .execute(),
      db.db
        .selectFrom('ipld_block')
        .where('creator', '=', carol.did)
        .selectAll()
        .execute(),
    ])

    expect(roots.length).toBe(0)
    expect(users.length).toBe(0)
    expect(blocks.length).toBe(0)
  })

  it('no longer stores indexed records from the user', async () => {
    const [posts, votes, reposts, follows] = await Promise.all([
      db.db
        .selectFrom('post')
        .where('creator', '=', carol.did)
        .selectAll()
        .execute(),
      db.db
        .selectFrom('vote')
        .where('creator', '=', carol.did)
        .selectAll()
        .execute(),
      db.db
        .selectFrom('repost')
        .where('creator', '=', carol.did)
        .selectAll()
        .execute(),
      db.db
        .selectFrom('follow')
        .where('creator', '=', carol.did)
        .selectAll()
        .execute(),

      db.db
        .selectFrom('user')
        .where('handle', '=', carol.handle)
        .selectAll()
        .execute(),
      db.db
        .selectFrom('ipld_block')
        .where('creator', '=', carol.did)
        .selectAll()
        .execute(),
    ])

    expect(posts.length).toBe(0)
    expect(votes.length).toBe(0)
    expect(reposts.length).toBe(0)
    expect(follows.length).toBe(0)
  })

  it('deletes relevant blobs', async () => {
    const imgs = sc.posts[carol.did][0].images
    // carols first blob is used by other accounts
    const first = CID.parse(imgs[0].image.cid)
    // carols second blob is used by only her
    const second = CID.parse(imgs[1].image.cid)
    const got = await blobstore.getBytes(first)
    expect(got).toBeDefined()
    const attempt = blobstore.getBytes(second)
    await expect(attempt).rejects.toThrow(BlobNotFoundError)

    const [repoBlobs, blobs] = await Promise.all([
      db.db
        .selectFrom('repo_blob')
        .where('did', '=', carol.did)
        .selectAll()
        .execute(),
      db.db
        .selectFrom('blob')
        .where('cid', 'in', [first.toString(), second.toString()])
        .selectAll()
        .execute(),
    ])

    expect(repoBlobs.length).toBe(0)
    expect(blobs.length).toBe(1)
    expect(blobs[0].cid).toEqual(first.toString())
  })

  it('no longer displays the users posts in feeds', async () => {
    const feed = await client.app.bsky.feed.getTimeline(undefined, {
      headers: sc.getHeaders(sc.dids.alice),
    })
    const found = feed.data.feed.filter(
      (item) => item.post.author.did === carol.did,
    )
    expect(found.length).toBe(0)
  })

  it('removes notifications from the user', async () => {
    const notifs = await client.app.bsky.notification.list(undefined, {
      headers: sc.getHeaders(sc.dids.alice),
    })
    const found = notifs.data.notifications.filter(
      (item) => item.author.did === sc.dids.carol,
    )
    expect(found.length).toBe(0)
  })
})
