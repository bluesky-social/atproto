'use strict'

/* eslint-env commonjs */
/* eslint-disable @typescript-eslint/no-var-requires */

const { Client, XrpcError, buildAgent } = require('@atproto/lex-client')
const { l } = require('@atproto/lex-schema')

module.exports.Client = Client
module.exports.XrpcError = XrpcError
module.exports.buildAgent = buildAgent
module.exports.l = l
