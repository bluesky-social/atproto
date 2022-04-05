import chalk from 'chalk'
import cmd from '../../lib/command.js'
import Checkout from '../../lib/checkout.js'
import { REPO_PATH } from '../../lib/env.js'

export default cmd({
  name: 'feed',
  category: 'posts',
  help: 'List all the posts in your feed, or the posts of the given user.',
  args: [{ name: 'user', optional: true }],
  async command(args) {
    const user = args._[0]
    const repo = await Checkout.load(REPO_PATH)

    const posts = await (user ? getUserPosts(repo, user) : getFeedPosts(repo))
    for (const post of posts) {
      console.log(`${chalk.bold(post.user)}`)
      console.log(post.text)
      console.log(``)
    }
  },
})

async function getUserPosts(checkout: Checkout, user: string) {
  // @@TODO: ???
  // const store = await checkout.getUserStore(user)
  // return store.posts
  return []
}

async function getFeedPosts(checkout: Checkout) {
  const store = await repo.getLocalUserStore()
  let posts = store.posts
  for (const follow of store.follows) {
    posts = posts.concat(await getUserPosts(repo, follow.did))
  }
  return posts
}
