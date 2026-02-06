import type { IncomingMessage, ServerResponse } from 'node:http'
import { Customization } from '../../customization/customization.js'
import { AuthorizationResultAuthorizePage } from '../../result/authorization-result-authorize-page.js'
import { SendWebAppOptions, sendWebAppFactory } from './assets.js'

export function sendAuthorizePageFactory(
  customization: Customization,
  options?: SendWebAppOptions,
) {
  const sendApp = sendWebAppFactory(
    'authorization-page',
    customization,
    options,
  )

  return async function sendAuthorizePage(
    req: IncomingMessage,
    res: ServerResponse,
    data: AuthorizationResultAuthorizePage,
  ): Promise<void> {
    return sendApp(req, res, {
      data: {
        __authorizeData: {
          requestUri: data.requestUri,

          clientId: data.client.id,
          clientMetadata: data.client.metadata,
          clientTrusted: data.client.info.isTrusted,
          clientFirstParty: data.client.info.isFirstParty,

          scope: data.parameters.scope,
          uiLocales: data.parameters.ui_locales,
          loginHint: data.parameters.login_hint,
          promptMode: data.parameters.prompt,
          permissionSets: Object.fromEntries(data.permissionSets),
        },
        __sessions: data.sessions,
      },
    })
  }
}
