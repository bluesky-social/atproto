import chalk from 'chalk'
import cmd from '../../lib/command'
import { loadClient } from '../../lib/client'
import { REPO_PATH } from '../../lib/env'

export default cmd({
  name: 'whois',
  category: 'social',
  help: 'Display the profile of the given user.',
  args: [{ name: 'username' }],
  opts: [],
  async command(args) {
    const nameOrDid = args._[0]
    const client = await loadClient(REPO_PATH)
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
