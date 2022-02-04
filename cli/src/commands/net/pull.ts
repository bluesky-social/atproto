import cmd from '../../lib/command.js'

export default cmd({
  name: 'pull',
  category: 'net',
  help: 'Pull the latest data for all followed users or for a given user.',
  args: [
    {name: 'id', optional: true}
  ],
  opts: [],
  async command (args) {
    throw new Error('TODO')
  }
})