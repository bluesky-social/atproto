import { DevEnv } from './dist/index.js'
import * as env from './dist/env.js'

DevEnv.create(env.load())
