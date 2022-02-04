import chalk from 'chalk'
import cmd from '../../lib/command.js'
import { Repo } from '../../lib/repo.js'
import { REPO_PATH } from '../../lib/env.js'

export default cmd({
  name: 'feed',
  category: 'posts',
  help: 'List all the posts in your feed, or the posts of the given user.',
  args: [{name: 'user', optional: true}],
  async command (args) {
    const user = args._[0]
    const repo = await Repo.load(REPO_PATH)

    const posts = await (user ? getUserPosts(repo, user) : getFeedPosts(repo))
    for (const post of posts) {
      console.log(`${chalk.bold(post.user)}`)
      console.log(post.text)
      console.log(``)
    }
  }
})

async function getUserPosts (repo: Repo, user: string) {
  const store = await repo.getUserStore(user)
  return store.posts
}

async function getFeedPosts (repo: Repo) {
  const store = await repo.getLocalUserStore()
  let posts = store.posts
  for (const follow of store.follows) {
    posts = posts.concat(await getUserPosts(repo, follow.did))
  }
  return posts
}