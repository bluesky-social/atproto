import chalk from 'chalk'
import cmd from '../../lib/command.js'
import { loadClient } from '../../lib/client.js'
import { REPO_PATH } from '../../lib/env.js'

export default cmd({
  name: 'whoami',
  category: 'social',
  help: 'Display the profile of the local user.',
  args: [],
  opts: [],
  async command(args) {
    const client = await loadClient(REPO_PATH)
    const info = await client.getAccountInfo(client.did)
    if (info === null) {
      throw new Error(`Could not find user ${client.did}`)
    }
    console.log(`${info.username} ${chalk.gray(info.did)}`)
    console.log(`Posts: ${info.postCount}`)
    console.log(`Follows: ${info.followCount}`)
    console.log(`Followers: ${info.followerCount}`)
  },
})
