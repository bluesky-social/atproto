export default {
  lexicon: 1,
  id: 'com.example.poll',
  type: 'record',
  record: {
    type: 'object',
    required: ['question', 'answers'],
    properties: {
      queries: { type: 'string', maxLength: 1024 },
      answers: {
        type: 'array',
        items: { type: 'string', maxLength: 100 },
      },
    },
  },
}
