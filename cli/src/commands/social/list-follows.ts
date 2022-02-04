import { service } from '@bluesky-demo/common'
import cmd from '../../lib/command.js'
import { Repo } from '../../lib/repo.js'
import { REPO_PATH } from '../../lib/env.js'

export default cmd({
  name: 'list follows',
  category: 'social',
  help: 'List the follows for the given user (default to self).',
  args: [
    {name: 'id', optional: true}
  ],
  opts: [],
  async command (args) {
    const id = args._[0]
    const repo = await Repo.load(REPO_PATH)
    const store = id ? await repo.getUserStore(id) : await repo.getLocalUserStore()
    console.log(`${store.follows.length} followed`)
    for (const follow of store.follows) {
      console.log(`${follow.username.padEnd(10)} ${follow.did}`)
    }
  }
})