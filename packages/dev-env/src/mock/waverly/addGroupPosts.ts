import { postTexts } from '../data'
import User from './User'

export default async (
  posts: { uri: string; cid: string }[],
  users: User[],
  date: Generator<string>,
) => {
  const betterweb = users.find((u) => u.handle === 'betterweb.group')
  if (!betterweb) throw new Error('Cannot find group user betterweb')

  // The betterweb group reposts a few posts
  const betterwebPosts: { uri: string; cid: string }[] = []
  for (const [index, post] of posts.entries()) {
    // Only repost long enough posts that are top-of-thread
    if (postTexts[index]?.length ?? 0 > 50) {
      betterwebPosts.push(
        await betterweb.agent.api.app.bsky.feed.repost.create(
          { repo: betterweb.did },
          {
            subject: post,
            createdAt: date.next().value,
          },
        ),
      )
    }
  }
}
