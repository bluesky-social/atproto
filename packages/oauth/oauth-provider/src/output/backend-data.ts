import { Html, js } from '../lib/html/index.js'

export function declareBackendData(values: Record<string, unknown>): Html {
  return Html.dangerouslyCreate(backendDataGenerator(values))
}

export function* backendDataGenerator(
  values: Record<string, unknown>,
): Generator<Html> {
  for (const [key, val] of Object.entries(values)) {
    yield js`window[${key}]=${val};`
  }
  // The script tag is removed after the data is assigned to the global
  // variables to prevent other scripts from reading the values. The "app"
  // script will read the global variable and then unset it. See
  // `readBackendData()` in "src/assets/app/backend-data.ts".
  yield js`document.currentScript.remove();`
}
