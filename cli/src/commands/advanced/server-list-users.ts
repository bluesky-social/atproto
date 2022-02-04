import cmd from '../../lib/command.js'
import { service } from '@bluesky-demo/common'

export default cmd({
  name: 'server list users',
  category: 'advanced',
  help: 'List the users in the configured server.',
  args: [],
  opts: [],
  async command (args) {
    const users = await service.fetchUsers()
    console.log(`${users.length} users`)
    for (const user of users) {
      console.log(`${user.name.padEnd(10)} ${user.did}`)
    }
  }
})