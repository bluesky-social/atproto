import cmd from '../../lib/command.js'

export default cmd({
  name: 'server list users',
  category: 'advanced',
  help: 'List the users in the configured server.',
  args: [],
  opts: [],
  async command (args) {
    throw new Error('TODO')
  }
})