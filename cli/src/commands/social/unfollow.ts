import cmd from '../../lib/command.js'

export default cmd({
  name: 'unfollow',
  category: 'social',
  help: 'Unfollow the given user.',
  args: [
    {name: 'id'}
  ],
  opts: [],
  async command (args) {
    throw new Error('TODO')
  }
})