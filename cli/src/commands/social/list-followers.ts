import cmd from '../../lib/command.js'
import { loadDelegate } from '../../lib/client.js'
import { REPO_PATH } from '../../lib/env.js'

export default cmd({
  name: 'list followers',
  category: 'social',
  help: 'List the followers for the given user (default to self).',
  args: [{ name: 'id', optional: true }],
  opts: [],
  async command(args) {
    throw new Error('TODO')
    // const client = await loadDelegate(REPO_PATH)

    // const follows = await client.listFollows()
    // console.log('Follows: ')
    // follows.forEach((f) => {
    //   console.log(`${f.username}: ${f.did}`)
    // })
  },
})
