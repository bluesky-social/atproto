import test from 'ava'

import * as ucan from 'ucans'
import * as auth from '../src/auth/index.js'

import Microblog from '../src/microblog/index.js'
import Repo from '../src/repo/index.js'
import IpldStore from '../src/blockstore/ipld-store.js'

import TID from '../src/repo/tid.js'

type Context = {
  ipld: IpldStore
  keypair: ucan.EdKeypair
  repo: Repo
  microblog: Microblog
}

test.beforeEach(async (t) => {
  const ipld = IpldStore.createInMemory()
  const keypair = await ucan.EdKeypair.create()
  const token = await auth.claimFull(keypair.did(), keypair)
  const ucanStore = await ucan.Store.fromTokens([token.encoded()])
  const repo = await Repo.create(ipld, keypair.did(), keypair, ucanStore)
  const microblog = new Microblog(repo)
  t.context = { ipld, keypair, repo, microblog } as Context
  t.pass('Context setup')
})

test('basic post operations', async (t) => {
  const { microblog } = t.context as Context
  const created = await microblog.addPost('hello world')
  const tid = TID.fromStr(created.tid)
  const post = await microblog.getPost(tid)
  t.is(post?.text, 'hello world', 'retrieves correct post')

  await microblog.editPost(tid, 'edit')
  const edited = await microblog.getPost(tid)
  t.is(edited?.text, 'edit', 'edits posts')

  await microblog.deletePost(tid)
  const deleted = await microblog.getPost(tid)
  t.is(deleted, null, 'deletes post')
})

test('basic like operations', async (t) => {
  const { microblog } = t.context as Context
  const post = await microblog.addPost('hello world')
  const likeTid = await microblog.likePost(post.author, TID.fromStr(post.tid))
  let likes = await microblog.listLikes(1)
  t.is(likes.length, 1, 'correct number of likes')
  t.is(likes[0]?.tid, likeTid.toString(), 'correct id on like')
  t.is(likes[0]?.post_tid, post.tid, 'correct post_id on like')

  await microblog.deleteLike(likeTid)
  likes = await microblog.listLikes(1)
  t.is(likes.length, 0, 'deletes likes')
})
