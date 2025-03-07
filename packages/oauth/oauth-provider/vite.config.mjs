import { lingui } from '@lingui/vite-plugin'
import react from '@vitejs/plugin-react-swc'

/**
 * @see {@link https://vitejs.dev/config/}
 * @type {import('vite').UserConfig}
 */
export default {
  root: './src/assets/app',
  plugins: [
    react({
      plugins: [['@lingui/swc-plugin', {}]],
    }),
    lingui(),
  ],
}
