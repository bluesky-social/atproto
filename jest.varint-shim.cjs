// Shim for varint that works around cjs-module-lexer not detecting
// comma-first style exports (which prevents Jest ESM interop from
// exposing named exports in SyntheticModule).
const _varint = require('./node_modules/.pnpm/varint@6.0.0/node_modules/varint/index.js')
exports.encode = _varint.encode
exports.decode = _varint.decode
exports.encodingLength = _varint.encodingLength
