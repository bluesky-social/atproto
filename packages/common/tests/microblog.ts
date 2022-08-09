import * as auth from '@adxp/auth'

import { MicroblogFull } from '../src/microblog/index'
import Repo from '../src/repo/index'
import IpldStore from '../src/blockstore/ipld-store'

describe('Microblog', () => {
  let microblog: MicroblogFull

  beforeAll(async () => {
    const ipld = IpldStore.createInMemory()
    const authStore = await auth.MemoryStore.load()
    await authStore.claimFull()
    const repo = await Repo.create(ipld, await authStore.did(), authStore)
    microblog = new MicroblogFull(repo, '', { pushOnUpdate: false })
  })

  it('basic post operations', async () => {
    const created = await microblog.addPost('hello world')
    const tid = created.tid
    const post = await microblog.getPost(tid)
    expect(post?.text).toBe('hello world')

    await microblog.editPost(tid, 'edit')
    const edited = await microblog.getPost(tid)
    expect(edited?.text).toBe('edit')

    await microblog.deletePost(tid)
    const deleted = await microblog.getPost(tid)
    expect(deleted).toBe(null)
  })

  it('basic like operations', async () => {
    const post = await microblog.addPost('hello world')
    const like = await microblog.likePost(post.author, post.tid)
    let likes = await microblog.listLikes(1)
    expect(likes.length).toBe(1)
    expect(likes[0]?.tid?.toString()).toBe(like.tid.toString())
    expect(likes[0]?.post_tid?.toString()).toBe(post.tid?.toString())

    await microblog.deleteLike(like.tid)
    likes = await microblog.listLikes(1)
    expect(likes.length).toBe(0)
  })
})
