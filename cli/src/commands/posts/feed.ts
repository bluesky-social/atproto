import { service } from '@bluesky-demo/common'
import * as ucan from 'ucans'
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
    const store = await repo.getLocalUserStore()

    // TODO - handle per-user, handle merged feed
    // TODO - format output
    console.log(store.posts)
  }
})