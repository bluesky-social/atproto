import cmd from '../../lib/command.js'

export default cmd({
  name: 'edit post',
  category: 'posts',
  help: 'Edit an existing post.',
  args: [
    {name: 'id'},
    {name: 'text'}
  ],
  opts: [],
  async command (args) {
    throw new Error('TODO')
  }
})