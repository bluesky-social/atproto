import cmd from '../../lib/command.js'
import { loadClient } from '../../lib/client.js'
import { REPO_PATH } from '../../lib/env.js'
import { TID } from '@adxp/common'

export default cmd({
  name: 'unlike',
  category: 'interactions',
  help: 'Unlike a post.',
  args: [{ name: 'author' }, { name: 'post_id' }],
  opts: [],
  async command(args) {
    const authorNameOrDid = args._[0]
    const postTid = TID.fromStr(args._[1])
    const client = await loadClient(REPO_PATH)
    await client.unlikePost(authorNameOrDid, postTid)
    console.log('Deleted Like')
  },
})
