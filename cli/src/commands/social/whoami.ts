import chalk from 'chalk'
import cmd from '../../lib/command.js'
import { Repo } from '../../lib/repo.js'
import { REPO_PATH } from '../../lib/env.js'

export default cmd({
  name: 'whoami',
  category: 'social',
  help: 'Display the profile of the local user.',
  args: [],
  opts: [],
  async command (args) {
    const repo = await Repo.load(REPO_PATH)
    const store = await repo.getLocalUserStore()
    console.log(`${repo.account.name} ${chalk.gray(repo.account.did)}`)
    console.log(`${store.posts.length} posts | ${store.follows.length} followed`) // @TODO follower count
  }
})