import chalk from 'chalk'
import cmd from '../../lib/command'
import { loadClient } from '../../lib/client'
import { REPO_PATH } from '../../lib/env'

export default cmd({
  name: 'list follows',
  category: 'social',
  help: 'List the follows for the given user (default to self).',
  args: [{ name: 'username/did', optional: true }],
  opts: [],
  async command(args) {
    const client = await loadClient(REPO_PATH)
    const did = args._[0] || client.did
    const follows = await client.listFollowsFromUser(did)

    console.log(``)
    console.log(`Follows for ${did}: `)
    console.log(``)
    follows.forEach((f) => {
      console.log(`${f.username.padEnd(10)} ${chalk.gray(f.did)}`)
    })
  },
})
