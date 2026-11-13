{
  "lexicon": 1,
  "id": "internal.bsky.actor.getProfiles",
  "defs": {
    "main": {
      "type": "query",
      "description": "Get detailed profile views of multiple actors, hydrating social proof (known followers) only for a subset of them. Intended for internal service-to-service use.",
      "parameters": {
        "type": "params",
        "required": ["dids"],
        "properties": {
          "dids": {
            "type": "array",
            "items": { "type": "string", "format": "did" },
            "maxLength": 200
          },
          "viewer": {
            "type": "string",
            "format": "did",
            "description": "DID of the account on whose behalf the request is made (not included for public/unauthenticated requests). Used for viewer-relative state, including social proof."
          },
          "socialProof": {
            "type": "array",
            "description": "DIDs to hydrate social proof (known followers) for. DIDs not also present in `dids` are ignored.",
            "items": { "type": "string", "format": "did" },
            "maxLength": 200
          },
          "includeTakedowns": {
            "type": "boolean",
            "default": false,
            "description": "Include taken-down accounts in the response rather than omitting them. For service-to-service moderation use only."
          }
        }
      },
      "output": {
        "encoding": "application/json",
        "schema": {
          "type": "object",
          "required": ["profiles"],
          "properties": {
            "profiles": {
              "type": "array",
              "items": {
                "type": "ref",
                "ref": "app.bsky.actor.defs#profileViewDetailed"
              }
            }
          }
        }
      }
    }
  }
}
