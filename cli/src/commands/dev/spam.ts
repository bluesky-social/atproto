import cmd from '../../lib/command.js'
import { loadDelegate } from '../../lib/client.js'
import { REPO_PATH } from '../../lib/env.js'
import { TID } from '@bluesky/common'

function makeRandText(l: number) {
    var set = ' abcdefghijklmnopqrstuvwxyz  ';
    var len = set.length;
    var out = '';
    for ( let i = 0; i < len; i++ ) {
      out += set.charAt(Math.floor(Math.random() * 
 len));
   }
   return out;
}

export default cmd({
  name: 'gen-random-posts',
  category: 'dev',
  help: 'Create a large number of random posts.',
  args: [{ name: 'count' }],
  async command(args) {
    const count : number = +(args._[0])
    const client = await loadDelegate(REPO_PATH)

    for (let i = 0; i < count; i++) {
      await client.addPost(makeRandText(100))
    }

  },
})
