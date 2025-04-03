import { lingui } from '@lingui/vite-plugin'
import react from '@vitejs/plugin-react-swc'

/**
 * @see {@link https://vitejs.dev/config/}
 * @type {import('vite').UserConfig}
 */
export default {
  root: './src',
  plugins: [
    react({
      plugins: [['@lingui/swc-plugin', {}]],
    }),
    lingui(),
  ],
  optimizeDeps: {
    // Needed because this is a monorepo and it exposes CommonJS
    include: ['@atproto/oauth-provider-api'],
  },
}
