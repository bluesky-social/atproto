import chalk from 'chalk'
import cmd from '../../lib/command.js'
import { Repo } from '../../lib/repo.js'
import { REPO_PATH } from '../../lib/env.js'

export default cmd({
  name: 'whois',
  category: 'social',
  help: 'Display the profile of the given user.',
  args: [
    {name: 'id'}
  ],
  opts: [],
  async command (args) {
    const repo = await Repo.load(REPO_PATH)
    const store = await repo.getUserStore(args._[0])
    const user = await store.getUser()
    console.log(`${user.name} ${chalk.gray(user.did)}`)
    console.log(`${store.posts.length} posts | ${store.follows.length} followed`) // @TODO follower count
  }
})