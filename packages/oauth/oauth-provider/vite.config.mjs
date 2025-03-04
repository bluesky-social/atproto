import { lingui } from '@lingui/vite-plugin'
import react from '@vitejs/plugin-react-swc'
import postcss from 'rollup-plugin-postcss'

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
    // @ts-expect-error This package is wrongly typed
    postcss(),
  ],
}
