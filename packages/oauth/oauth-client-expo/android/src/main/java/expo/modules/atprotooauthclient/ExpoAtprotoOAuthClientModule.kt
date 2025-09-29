package expo.modules.atprotooauthclient

import expo.modules.atprotooauthclient.Crypto
import expo.modules.atprotooauthclient.Jose
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoAtprotoOAuthClientModule : Module() {
  override fun definition() =
    ModuleDefinition {
      Name("ExpoAtprotoOAuthClient")

      AsyncFunction("digest") { data: ByteArray, algo: String ->
        if (algo != "sha256") {
          throw IllegalArgumentException("Unsupported algorithm: $algo")
        }
        return@AsyncFunction Crypto().digest(data)
      }

      AsyncFunction("getRandomValues") { byteLength: Int ->
        return@AsyncFunction Crypto().getRandomValues(byteLength)
      }

      AsyncFunction("generatePrivateJwk") { algo: String ->
        if (algo != "ES256") {
          throw IllegalArgumentException("Unsupported algorithm: $algo")
        }
        return@AsyncFunction Crypto().generateJwk()
      }

      AsyncFunction("createJwt") { header: String, payload: String, encodedJwk: EncodedJWK ->
        val jwk = Crypto().decodeJwk(encodedJwk)
        return@AsyncFunction Jose().createJwt(header, payload, jwk)
      }

      AsyncFunction("verifyJwt") { token: String, encodedJwk: EncodedJWK, options: VerifyOptions ->
        val jwk = Crypto().decodeJwk(encodedJwk)
        return@AsyncFunction Jose().verifyJwt(token, jwk, options)
      }
    }
}
