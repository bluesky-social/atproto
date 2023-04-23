import assert from 'assert'
import { once, EventEmitter } from 'events'
import { Selectable } from 'kysely'
import Mail from 'nodemailer/lib/mailer'
import AtpAgent from '@atproto/api'
import { isThreadViewPost } from '@atproto/api/src/client/types/app/bsky/feed/defs'
import { SeedClient } from './seeds/client'
import basicSeed from './seeds/basic'
import { Database } from '../src'
import * as util from './_util'
import { ServerMailer } from '../src/mailer'
import { BlobNotFoundError, BlobStore } from '@atproto/repo'
import { RepoRoot } from '../src/db/tables/repo-root'
import { UserAccount } from '../src/db/tables/user-account'
import { IpldBlock } from '../src/db/tables/ipld-block'
import { Post } from '../src/app-view/db/tables/post'
import { Like } from '../src/app-view/db/tables/like'
import { Repost } from '../src/app-view/db/tables/repost'
import { Follow } from '../src/app-view/db/tables/follow'
import { RepoBlob } from '../src/db/tables/repo-blob'
import { Blob } from '../src/db/tables/blob'
import {
  PostEmbedImage,
  PostEmbedExternal,
  PostEmbedRecord,
} from '../src/app-view/db/tables/post-embed'
import { RepoCommitHistory } from '../src/db/tables/repo-commit-history'
import { RepoCommitBlock } from '../src/db/tables/repo-commit-block'
import { Record } from '../src/db/tables/record'
import { RepoSeq } from '../src/db/tables/repo-seq'

describe('account deletion', () => {
  let agent: AtpAgent
  let close: util.CloseFn
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
    const server = await util.runTestServer({
      dbPostgresSchema: 'account_deletion',
    })
    close = server.close
    mailer = server.ctx.mailer
    db = server.ctx.db
    blobstore = server.ctx.blobstore
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
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

  it('deletes account with a valid token & password, updating aggregations', async () => {
    const postAUri = sc.posts[sc.dids.alice][1].ref.uriStr
    const postBUri = sc.posts[sc.dids.dan][1].ref.uriStr
    const { data: profileBefore } = await agent.api.app.bsky.actor.getProfile(
      { actor: sc.dids.alice },
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    const { data: threadBeforeA } = await agent.api.app.bsky.feed.getPostThread(
      { uri: postAUri, depth: 0 },
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    const { data: threadBeforeB } = await agent.api.app.bsky.feed.getPostThread(
      { uri: postBUri, depth: 0 },
      { headers: sc.getHeaders(sc.dids.alice) },
    )

    // Perform account deletion
    await agent.api.com.atproto.server.deleteAccount({
      token,
      did: carol.did,
      password: carol.password,
    })

    // Check aggregations: some will be decremented now that the account is deleted.
    const { data: profileAfter } = await agent.api.app.bsky.actor.getProfile(
      { actor: sc.dids.alice },
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    const { data: threadAfterA } = await agent.api.app.bsky.feed.getPostThread(
      { uri: postAUri, depth: 0 },
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    const { data: threadAfterB } = await agent.api.app.bsky.feed.getPostThread(
      { uri: postBUri, depth: 0 },
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    assert(isThreadViewPost(threadBeforeA.thread))
    assert(isThreadViewPost(threadBeforeB.thread))
    assert(isThreadViewPost(threadAfterA.thread))
    assert(isThreadViewPost(threadAfterB.thread))
    expect(profileAfter.followsCount).toEqual(profileBefore.followsCount)
    expect(profileAfter.followersCount).toEqual(
      (profileBefore.followersCount ?? 0) - 1,
    )
    expect(profileAfter.postsCount).toEqual(profileBefore.postsCount)
    expect(threadAfterA.thread.post.likeCount).toEqual(
      (threadBeforeA.thread.post.likeCount ?? 0) - 1,
    )
    expect(threadAfterA.thread.post.replyCount).toEqual(
      (threadBeforeA.thread.post.replyCount ?? 0) - 1,
    )
    expect(threadAfterA.thread.post.repostCount).toEqual(
      threadBeforeA.thread.post.repostCount,
    )
    expect(threadAfterB.thread.post.likeCount).toEqual(
      threadBeforeB.thread.post.likeCount,
    )
    expect(threadAfterB.thread.post.replyCount).toEqual(
      threadBeforeB.thread.post.replyCount,
    )
    expect(threadAfterB.thread.post.repostCount).toEqual(
      (threadBeforeB.thread.post.repostCount ?? 0) - 1,
    )
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
    expect(updatedDbContents.seqs).toEqual(
      initialDbContents.seqs.filter((row) => row.did !== carol.did),
    )
    expect(updatedDbContents.commitBlocks).toEqual(
      initialDbContents.commitBlocks.filter((row) => row.creator !== carol.did),
    )
    expect(updatedDbContents.commitHistories).toEqual(
      initialDbContents.commitHistories.filter(
        (row) => row.creator !== carol.did,
      ),
    )
  })

  it('no longer stores indexed records from the user', async () => {
    expect(updatedDbContents.records).toEqual(
      initialDbContents.records.filter((row) => row.did !== carol.did),
    )
    expect(updatedDbContents.posts).toEqual(
      initialDbContents.posts.filter((row) => row.creator !== carol.did),
    )
    expect(updatedDbContents.likes).toEqual(
      initialDbContents.likes.filter((row) => row.creator !== carol.did),
    )
    expect(updatedDbContents.reposts).toEqual(
      initialDbContents.reposts.filter((row) => row.creator !== carol.did),
    )
    expect(updatedDbContents.follows).toEqual(
      initialDbContents.follows.filter((row) => row.creator !== carol.did),
    )
    expect(updatedDbContents.postImages).toEqual(
      initialDbContents.postImages.filter(
        (row) => !row.postUri.includes(carol.did),
      ),
    )
    expect(updatedDbContents.postExternals).toEqual(
      initialDbContents.postExternals.filter(
        (row) => !row.postUri.includes(carol.did),
      ),
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

  it('no longer displays the users posts in feeds', async () => {
    const feed = await agent.api.app.bsky.feed.getTimeline(undefined, {
      headers: sc.getHeaders(sc.dids.alice),
    })
    const found = feed.data.feed.filter(
      (item) => item.post.author.did === carol.did,
    )
    expect(found.length).toBe(0)
  })

  it('removes notifications from the user', async () => {
    const notifs = await agent.api.app.bsky.notification.listNotifications(
      undefined,
      {
        headers: sc.getHeaders(sc.dids.alice),
      },
    )
    const found = notifs.data.notifications.filter(
      (item) => item.author.did === sc.dids.carol,
    )
    expect(found.length).toBe(0)
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
  users: UserAccount[]
  blocks: IpldBlock[]
  seqs: Selectable<RepoSeq>[]
  commitHistories: RepoCommitHistory[]
  commitBlocks: RepoCommitBlock[]
  records: Record[]
  posts: Post[]
  postImages: PostEmbedImage[]
  postExternals: PostEmbedExternal[]
  postRecords: PostEmbedRecord[]
  likes: Like[]
  reposts: Repost[]
  follows: Follow[]
  repoBlobs: RepoBlob[]
  blobs: Blob[]
}

const getDbContents = async (db: Database): Promise<DbContents> => {
  const [
    roots,
    users,
    blocks,
    seqs,
    commitHistories,
    commitBlocks,
    records,
    posts,
    postImages,
    postExternals,
    postRecords,
    likes,
    reposts,
    follows,
    repoBlobs,
    blobs,
  ] = await Promise.all([
    db.db.selectFrom('repo_root').orderBy('did').selectAll().execute(),
    db.db.selectFrom('user_account').orderBy('did').selectAll().execute(),
    db.db
      .selectFrom('ipld_block')
      .orderBy('creator')
      .orderBy('cid')
      .selectAll()
      .execute(),
    db.db.selectFrom('repo_seq').orderBy('seq').selectAll().execute(),
    db.db
      .selectFrom('repo_commit_history')
      .orderBy('creator')
      .orderBy('commit')
      .selectAll()
      .execute(),
    db.db
      .selectFrom('repo_commit_block')
      .orderBy('creator')
      .orderBy('commit')
      .orderBy('block')
      .selectAll()
      .execute(),
    db.db.selectFrom('record').orderBy('uri').selectAll().execute(),
    db.db.selectFrom('post').orderBy('uri').selectAll().execute(),
    db.db
      .selectFrom('post_embed_image')
      .orderBy('postUri')
      .selectAll()
      .execute(),
    db.db
      .selectFrom('post_embed_external')
      .orderBy('postUri')
      .selectAll()
      .execute(),
    db.db
      .selectFrom('post_embed_record')
      .orderBy('postUri')
      .selectAll()
      .execute(),
    db.db.selectFrom('like').orderBy('uri').selectAll().execute(),
    db.db.selectFrom('repost').orderBy('uri').selectAll().execute(),
    db.db.selectFrom('follow').orderBy('uri').selectAll().execute(),
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
    commitHistories,
    commitBlocks,
    records,
    posts,
    postImages,
    postExternals,
    postRecords,
    likes,
    reposts,
    follows,
    repoBlobs,
    blobs,
  }
}
