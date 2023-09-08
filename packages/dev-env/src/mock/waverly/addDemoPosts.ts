import User from './User'
import { demoPosts } from './demoPosts'
import { AtUri } from '@atproto/uri'
import postMiniBlog from './post'

// TODO no second level reply

const postComment = async (
  text: string,
  replyTo: string,
  user: User,
  date: Generator<string>,
) => {
  try {
    const createdAt = date.next().value
    let reply
    const replyToUrip = new AtUri(replyTo)
    const parentPost = await user.agent.api.com.atproto.repo.getRecord({
      repo: replyToUrip.host,
      collection: 'app.bsky.feed.post',
      rkey: replyToUrip.rkey,
    })
    if (parentPost) {
      const parentRef = {
        uri: parentPost.data.uri,
        cid: parentPost.data.cid,
      }
      reply = {
        root: (parentPost.data.value as any).reply?.root || parentRef,
        parent: parentRef,
      }
      const bskyPost = await user.agent.api.app.bsky.feed.post.create(
        { repo: user.did },
        {
          text,
          reply,
          createdAt,
        },
      )
      return bskyPost.uri
    }
  } catch (err) {
    console.log(`ERROR: ${JSON.stringify(err, null, 2)}`)
  }
}

export default async (allUsers: User[], date: Generator<string>) => {
  const groups = new Map()
  const users = new Map()

  allUsers.forEach((u) => {
    if (u.handle.endsWith('.group')) groups.set(u.handle, u)
    else users.set(u.handle, u)
  })

  if (users.size === 0) throw new Error('Cannot find non-group users')
  const userArr = Array.from(users.values())
  let userIndex = 0
  for (const post of demoPosts.reverse()) {
    const uri = await postMiniBlog(
      post,
      users.get(post.user),
      groups.get(post.group),
      date,
    )
    for (const reply of post.replies) {
      const replyIndex = (userIndex + 1) % userArr.length
      const rUri = await postComment(reply.text, uri, userArr[replyIndex], date)
      for (const subReply of reply.replies) {
        const sReplyIndex = (userIndex + 2) % userArr.length
        if (rUri) {
          await postComment(subReply.text, rUri, userArr[sReplyIndex], date)
        }
      }
    }

    userIndex = (userIndex + 1) % userArr.length
  }
}
