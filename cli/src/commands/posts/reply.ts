import cmd from '../../lib/command.js'

export default cmd({
  name: 'reply',
  category: 'posts',
  help: 'Create a new reply post.',
  args: [
    {name: 'id'},
    {name: 'text'}
  ],
  opts: [],
  async command (args) {
    throw new Error('TODO')
  }
})