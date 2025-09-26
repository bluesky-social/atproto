package expo.modules.atprotoauth

import expo.modules.expoatprotoauth.Crypto
import expo.modules.expoatprotoauth.Jose
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoAtprotoOAuthClientModule : Module() {
  override fun definition() =
    ModuleDefinition {
      Name("ExpoAtprotoOAuthClient")

      Function("digest") { data: ByteArray, algo: String ->
        if (algo != "sha256") {
          throw IllegalArgumentException("Unsupported algorithm: $algo")
        }
        return@Function Crypto().digest(data)
      }

      Function("getRandomValues") { byteLength: Int ->
        return@Function Crypto().getRandomValues(byteLength)
      }

      Function("generatePrivateJwk") { algo: String ->
        if (algo != "ES256") {
          throw IllegalArgumentException("Unsupported algorithm: $algo")
        }
        return@Function Crypto().generateJwk()
      }

      Function("createJwt") { header: String, payload: String, encodedJwk: EncodedJWK ->
        val jwk = Crypto().decodeJwk(encodedJwk)
        return@Function Jose().createJwt(header, payload, jwk)
      }

      Function("verifyJwt") { token: String, encodedJwk: EncodedJWK, options: VerifyOptions ->
        val jwk = Crypto().decodeJwk(encodedJwk)
        return@Function Jose().verifyJwt(token, jwk, options)
      }
    }
}
