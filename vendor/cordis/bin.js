#!/usr/bin/env node

import { Context } from '@onprem-ai/cordis'
import { pathToFileURL } from 'node:url'
import Loader from '@onprem-ai/cordis-plugin-loader'

const ctx = new Context()
ctx.baseUrl = pathToFileURL(process.cwd()).href + '/'

await ctx.plugin(Loader)
await ctx.loader.create({
  name: '@onprem-ai/cordis-plugin-include',
  config: {
    path: './cordis.yml',
  },
})
