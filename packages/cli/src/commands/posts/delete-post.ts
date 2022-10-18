import cmd from '../../lib/command'
import { loadClient } from '../../lib/client'
import { REPO_PATH } from '../../lib/env'
import { TID } from '@atproto/common'

export default cmd({
  name: 'delete post',
  category: 'posts',
  help: 'Delete an existing post.',
  args: [{ name: 'post_tid' }],
  opts: [],
  async command(args) {
    const client = await loadClient(REPO_PATH)
    const tid = TID.fromStr(args._[0])
    await client.deletePost(tid)
    console.log('Post deleted')
  },
})
