import test from 'ava'

import * as ucan from 'ucans'

import Microblog from '../src/microblog/index.js'
import Repo from '../src/repo/index.js'
import IpldStore from '../src/blockstore/ipld-store.js'

import * as util from './_util.js'
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
  const repo = await Repo.create(ipld, keypair)
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
  const likeTid = await microblog.likePost(post)
  let likes = await microblog.listLikes(1)
  t.is(likes.length, 1, 'correct number of likes')
  t.is(likes[0]?.tid, likeTid.toString(), 'correct id on like')
  t.is(likes[0]?.post_tid, post.tid, 'correct post_id on like')

  await microblog.unlikePost(likeTid)
  likes = await microblog.listLikes(1)
  t.is(likes.length, 0, 'deletes likes')
})

test('basic follow operations', async (t) => {
  const { microblog } = t.context as Context
  const userDid = util.randomDid()
  const username = 'alice'
  await microblog.followUser(username, userDid)

  let follow = await microblog.getFollow(userDid)
  t.is(follow?.did, userDid, 'correct did on follow')
  t.is(follow?.username, username, 'correct username on follow')

  const isFollowing = await microblog.isFollowing(userDid)
  t.true(isFollowing, 'correctly reports isFollowing DID')

  await microblog.unfollowUser(userDid)
  follow = await microblog.getFollow(userDid)
  t.is(follow, null, 'deletes follows')
})
