import cmd from '../../lib/command'

export default cmd({
  name: 'reply',
  category: 'posts',
  help: 'Create a new reply post.',
  args: [{ name: 'id' }, { name: 'text' }],
  opts: [],
  async command(args) {
    // @TODO
    throw new Error('Replies not implemented yet.')
  },
})
