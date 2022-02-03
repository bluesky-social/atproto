import cmd from '../../lib/command.js'

export default cmd({
  name: 'register',
  category: 'setup',
  help: 'Registers the repo with the configured server.',
  args: [],
  opts: [],
  async command (args) {
    throw new Error('TODO')
  }
})