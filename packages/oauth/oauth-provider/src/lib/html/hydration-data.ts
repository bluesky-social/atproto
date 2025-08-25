import { Html, js } from './index.js'

export function declareHydrationData<T extends Record<string, unknown>>(
  values: T,
): Html {
  return Html.dangerouslyCreate(hydrationDataGenerator(values))
}

export function* hydrationDataGenerator(
  values: Record<string, unknown>,
): Generator<Html> {
  for (const [key, val] of Object.entries(values)) {
    yield js`window[${key}]=JSON.parse(${JSON.stringify(val)});`
  }
  // The script tag is removed after the data is assigned to the global
  // variables to prevent other scripts from reading the values. The "app"
  // script will read the global variable and then unset it.
  yield js`document.currentScript.remove();`
}
