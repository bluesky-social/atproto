import cmd from '../../lib/command'
import { loadClient } from '../../lib/client'
import { REPO_PATH } from '../../lib/env'
import { TID } from '@atproto/common'

export default cmd({
  name: 'like',
  category: 'interactions',
  help: 'Like a post.',
  args: [{ name: 'author' }, { name: 'post_id' }],
  opts: [],
  async command(args) {
    const author = args._[0]
    const tid = TID.fromStr(args._[1])
    const client = await loadClient(REPO_PATH)
    const like = await client.likePost(author, tid)
    const likeTid = like.tid
    console.log(`Created like: `, likeTid.formatted())
  },
})
