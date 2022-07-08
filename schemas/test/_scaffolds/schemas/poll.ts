export default {
  $type: 'adxs-record',
  author: 'blueskyweb.xyz',
  name: 'Poll',
  locale: {
    'en-US': {
      nameSingular: 'Poll',
      namePlural: 'Polls',
    },
  },
  schema: {
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
