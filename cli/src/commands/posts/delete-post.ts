import cmd from '../../lib/command.js'
import { loadDelegate } from '../../lib/client.js'
import { REPO_PATH } from '../../lib/env.js'
import { TID } from '@bluesky/common'

export default cmd({
  name: 'delete post',
  category: 'posts',
  help: 'Delete an existing post.',
  args: [{ name: 'post_tid' }],
  opts: [],
  async command(args) {
    const client = await loadDelegate(REPO_PATH)
    const tid = TID.fromStr(args._[0])
    await client.deletePost(tid)
    console.log('Post deleted')
  },
})
