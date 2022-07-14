import cmd from '../../lib/command'

export default cmd({
  name: 'pull',
  category: 'repo',
  help: 'Pull the latest data for all followed users or for a given user.',
  args: [{ name: 'id', optional: true }],
  opts: [],
  async command(args) {
    // @TODO
    throw new Error('Repo pulls not implemented yet')
  },
})
