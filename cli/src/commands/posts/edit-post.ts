import cmd from '../../lib/command.js'
import { loadClient } from '../../lib/client.js'
import { REPO_PATH } from '../../lib/env.js'
import { TID } from '@adx/common'

export default cmd({
  name: 'edit post',
  category: 'posts',
  help: 'Edit an existing post.',
  args: [{ name: 'post_id' }, { name: 'text' }],
  opts: [],
  async command(args) {
    const client = await loadClient(REPO_PATH)
    const tid = TID.fromStr(args._[0])
    const text = args._[1]
    await client.editPost(tid, text)
    console.log('Post edited')
  },
})
