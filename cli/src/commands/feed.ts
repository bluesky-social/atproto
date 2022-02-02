import { service } from '@bluesky-demo/common'
import * as ucan from 'ucans'
import cmd from '../lib/command.js'
import { readRepo, writeRepo } from '../lib/repo.js'
import { REPO_PATH } from '../lib/env.js'

export default cmd({
  name: 'feed',
  category: 'social',
  help: 'List all the posts in your feed, or the posts of the given user.',
  args: [{name: 'user', optional: true}],
  async command (args) {
    const user = args._[0]
    const repo = await readRepo(REPO_PATH)

    // TODO - handle per-user, handle merged feed
    // TODO - format output
    console.log(repo.store.posts)
  }
})