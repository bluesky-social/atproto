import chalk from 'chalk'
import cmd from '../../lib/command.js'
import { loadDelegate } from '../../lib/client.js'
import { REPO_PATH } from '../../lib/env.js'

export default cmd({
  name: 'list followers',
  category: 'social',
  help: 'List the followers for the given user (default to self).',
  args: [{ name: 'username/did', optional: true }],
  opts: [],
  async command(args) {
    const client = await loadDelegate(REPO_PATH)
    const did = args._[0] || client.did
    const follows = await client.listFollowersForUser(did)

    console.log(``)
    console.log(`Followers of ${did}: `)
    console.log(``)
    follows.forEach((f) => {
      console.log(`${f.username.padEnd(10)} ${chalk.gray(f.did)}`)
    })
  },
})
