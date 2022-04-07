import chalk from 'chalk'
import cmd from '../../lib/command.js'
import { loadDelegate } from '../../lib/client.js'
import { REPO_PATH } from '../../lib/env.js'

export default cmd({
  name: 'whois',
  category: 'social',
  help: 'Display the profile of the given user.',
  args: [{ name: 'user' }],
  opts: [],
  async command(args) {
    const nameOrDid = args._[0]
    const client = await loadDelegate(REPO_PATH)
    const info = await client.getAccountInfo(nameOrDid)
    if (info === null) {
      throw new Error(`Could not find user ${nameOrDid}`)
    }
    console.log(`${info.username} ${chalk.gray(info.did)}`)
    console.log(`Posts: ${info.postCount}`)
    console.log(`Follows: ${info.followCount}`)
    console.log(`Followers: ${info.followerCount}`)
  },
})
