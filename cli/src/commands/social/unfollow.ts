import cmd from '../../lib/command.js'
import { loadDelegate } from '../../lib/client.js'
import { REPO_PATH } from '../../lib/env.js'

export default cmd({
  name: 'unfollow',
  category: 'social',
  help: 'Unfollow the given user.',
  args: [{ name: 'username/did' }],
  opts: [],
  async command(args) {
    const nameOrDid = args._[0]
    const client = await loadDelegate(REPO_PATH)
    await client.unfollowUser(nameOrDid)
    console.log('Unfollowed user')
  },
})
