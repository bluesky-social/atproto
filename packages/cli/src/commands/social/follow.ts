import cmd from '../../lib/command'
import { loadClient } from '../../lib/client'
import { REPO_PATH } from '../../lib/env'

export default cmd({
  name: 'follow',
  category: 'social',
  help: 'Follow the given user.',
  args: [{ name: 'username/did' }],
  opts: [],
  async command(args) {
    const nameOrDid = args._[0]
    const client = await loadClient(REPO_PATH)
    await client.followUser(nameOrDid)
    console.log('Follow created')
  },
})
