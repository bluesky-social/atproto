import cmd from '../../lib/command.js'
import { loadDelegate } from '../../lib/client.js'
import { REPO_PATH } from '../../lib/env.js'
import { TID } from '@bluesky-demo/common'

export default cmd({
  name: 'post',
  category: 'posts',
  help: 'Create a new post.',
  args: [{ name: 'text' }],
  async command(args) {
    const text = args._[0]
    const client = await loadDelegate(REPO_PATH)
    const post = await client.addPost(text)
    const tid = TID.fromStr(post.tid)
    console.log(`Created post: `, tid.formatted())
  },
})
