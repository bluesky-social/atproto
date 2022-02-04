import cmd from '../../lib/command.js'

export default cmd({
  name: 'delete post',
  category: 'posts',
  help: 'Delete an existing post.',
  args: [
    {name: 'id'}
  ],
  opts: [],
  async command (args) {
    throw new Error('TODO')
  }
})