const Jetstream = jest.fn().mockImplementation(() => {
  return {
    start: jest.fn().mockResolvedValue(true),
    close: jest.fn().mockResolvedValue(true),
    onCreate: jest.fn(),
    onDelete: jest.fn(),
    // Add other methods as needed
  }
})

module.exports = {
  Jetstream,
}
