export default {
  lexicon: 1,
  id: 'com.example.zeet',
  type: 'record',
  revision: 2,
  record: {
    type: 'object',
    required: ['text', 'createdAt'],
    properties: {
      text: { type: 'string', maxLength: 256 },
      textV2: { type: 'string', maxLength: 10000 },
      reply: {
        type: 'object',
        required: ['root'],
        properties: {
          root: { $ref: '#/$defs/link' },
          parent: { $ref: '#/$defs/link' },
        },
      },
      media: { type: 'array', items: { $ref: '#/$defs/embed' } },
      createdAt: { type: 'string', format: 'date-time' },
    },
    $defs: {
      link: {
        type: 'object',
        required: ['uri'],
        properties: {
          uri: { type: 'string', format: 'uri' },
          username: { type: 'string' },
        },
      },
      embed: {
        type: 'object',
        required: ['blobs'],
        properties: {
          caption: { type: 'string' },
          blobs: {
            type: 'object',
            required: ['original'],
            properties: {
              thumb: { $ref: '#/$defs/blob' },
              original: { $ref: '#/$defs/blob' },
            },
          },
        },
      },
      blob: {
        type: 'object',
        required: ['mimeType', 'blobId'],
        properties: {
          mimeType: { type: 'string' },
          blobId: { type: 'string' },
        },
      },
    },
  },
}
