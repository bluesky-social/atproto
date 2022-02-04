import cmd from '../../lib/command.js'

export default cmd({
  name: 'edit post',
  category: 'posts',
  help: 'Edit an existing post.',
  args: [
    {name: 'id', type: 'string'},
    {name: 'text', type: 'string'}
  ],
  opts: [],
  async command (args) {
    throw new Error('TODO')
  }
})