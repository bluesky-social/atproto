import cmd from '../../lib/command.js'

export default cmd({
  name: 'reply',
  category: 'posts',
  help: 'Create a new reply post.',
  args: [
    {name: 'id', type: 'string'},
    {name: 'text', type: 'string'}
  ],
  opts: [],
  async command (args) {
    throw new Error('TODO')
  }
})