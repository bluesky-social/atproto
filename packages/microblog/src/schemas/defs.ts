export const schemas = [{
  "$type": "adxs-record",
  "author": "blueskyweb.xyz",
  "name": "Badge",
  "$comment": "An assertion about the subject by this user.",
  "locale": {
    "en-US": {
      "nameSingular": "Badge",
      "namePlural": "Badges"
    }
  },
  "schema": {
    "type": "object",
    "required": [
      "assertion",
      "subject",
      "createdAt"
    ],
    "properties": {
      "assertion": {
        "oneOf": [
          {
            "$ref": "#/$defs/inviteAssertion"
          },
          {
            "$ref": "#/$defs/employeeAssertion"
          },
          {
            "$ref": "#/$defs/tagAssertion"
          },
          {
            "$ref": "#/$defs/unknownAssertion"
          }
        ]
      },
      "subject": {
        "type": "string"
      },
      "createdAt": {
        "type": "string",
        "format": "date-time"
      }
    },
    "$defs": {
      "inviteAssertion": {
        "type": "object",
        "required": [
          "type"
        ],
        "properties": {
          "type": {
            "const": "invite"
          }
        }
      },
      "employeeAssertion": {
        "type": "object",
        "required": [
          "type"
        ],
        "properties": {
          "type": {
            "const": "employee"
          }
        }
      },
      "tagAssertion": {
        "type": "object",
        "required": [
          "type",
          "tag"
        ],
        "properties": {
          "type": {
            "const": "tag"
          },
          "tag": {
            "type": "string",
            "maxLength": 64
          }
        }
      },
      "unknownAssertion": {
        "type": "object",
        "required": [
          "type"
        ],
        "properties": {
          "type": {
            "type": "string",
            "not": {
              "enum": [
                "invite",
                "employee",
                "tag"
              ]
            }
          }
        }
      }
    }
  },
  "$ext": {
    "adxs-doc": {
      "examples": [
        {
          "$type": "blueskyweb.xyz:Badge",
          "assertion": {
            "type": "employee"
          },
          "subject": {
            "did": "did:example:1234",
            "name": "alice.com"
          },
          "createdAt": "2010-01-01T19:23:24Z"
        },
        {
          "$type": "blueskyweb.xyz:Badge",
          "assertion": {
            "type": "tag",
            "tag": "tech"
          },
          "subject": {
            "did": "did:example:1234",
            "name": "alice.com"
          },
          "createdAt": "2010-01-01T19:23:24Z"
        },
        {
          "$type": "blueskyweb.xyz:Badge",
          "assertion": {
            "type": "something-else",
            "param": "allowed"
          },
          "subject": {
            "did": "did:example:1234",
            "name": "alice.com"
          },
          "createdAt": "2010-01-01T19:23:24Z"
        }
      ]
    }
  }
},{
  "$type": "adxs-collection",
  "author": "blueskyweb.xyz",
  "name": "Badges",
  "$comment": "Where you put badges.",
  "locale": {
    "en-US": {
      "nameSingular": "Badges",
      "namePlural": "Badges Collections"
    }
  }
},{
  "$type": "adxs-record",
  "author": "blueskyweb.xyz",
  "name": "EmbeddedMedia",
  "$comment": "A list of media embedded in a post or document.",
  "locale": {
    "en-US": {
      "nameSingular": "Embedded Media",
      "namePlural": "Embedded Media"
    }
  },
  "schema": {
    "type": "object",
    "required": [
      "media"
    ],
    "properties": {
      "media": {
        "type": "array",
        "items": {
          "$ref": "#/$defs/mediaEmbed"
        }
      }
    },
    "$defs": {
      "mediaEmbed": {
        "type": "object",
        "required": [
          "original"
        ],
        "properties": {
          "alt": {
            "type": "string"
          },
          "thumb": {
            "$ref": "#/$defs/mediaEmbedBlob"
          },
          "original": {
            "$ref": "#/$defs/mediaEmbedBlob"
          }
        }
      },
      "mediaEmbedBlob": {
        "type": "object",
        "required": [
          "mimeType",
          "blobId"
        ],
        "properties": {
          "mimeType": {
            "type": "string"
          },
          "blobId": {
            "type": "string"
          }
        }
      }
    }
  },
  "$ext": {
    "adxs-doc": {
      "examples": [
        {
          "$type": "blueskyweb.xyz:EmbeddedMedia",
          "media": [
            {
              "alt": "Me at the beach",
              "thumb": {
                "mimeType": "image/png",
                "blobId": "1234"
              },
              "original": {
                "mimeType": "image/png",
                "blobId": "1235"
              }
            }
          ]
        }
      ]
    }
  }
},{
  "$type": "adxs-view",
  "author": "blueskyweb.xyz",
  "name": "FeedView",
  "$comment": "A computed view of the home feed or a user's feed",
  "reads": [
    "blueskyweb.xyz:Feed",
    "blueskyweb.xyz:SocialGraph"
  ],
  "parameters": {
    "type": "object",
    "properties": {
      "author": {
        "type": "string"
      },
      "limit": {
        "type": "number",
        "maximum": 100
      },
      "before": {
        "type": "string",
        "format": "date-time"
      }
    }
  },
  "response": {
    "type": "object",
    "required": [
      "feed"
    ],
    "properties": {
      "feed": {
        "type": "array",
        "items": {
          "$ref": "#/$defs/feedItem"
        }
      }
    },
    "$defs": {
      "feedItem": {
        "type": "object",
        "required": [
          "uri",
          "author",
          "record",
          "replyCount",
          "repostCount",
          "likeCount",
          "indexedAt"
        ],
        "properties": {
          "uri": {
            "type": "string"
          },
          "author": {
            "$ref": "#/$defs/user"
          },
          "repostedBy": {
            "$ref": "#/$defs/user"
          },
          "record": {
            "type": "object"
          },
          "embed": {
            "oneOf": [
              {
                "$ref": "#/$defs/recordEmbed"
              },
              {
                "$ref": "#/$defs/externalEmbed"
              },
              {
                "$ref": "#/$defs/unknownEmbed"
              }
            ]
          },
          "replyCount": {
            "type": "number"
          },
          "repostCount": {
            "type": "number"
          },
          "likeCount": {
            "type": "number"
          },
          "indexedAt": {
            "type": "string",
            "format": "date-time"
          },
          "myState": {
            "type": "object",
            "properties": {
              "repost": {
                "type": "string"
              },
              "like": {
                "type": "string"
              }
            }
          }
        }
      },
      "user": {
        "type": "object",
        "required": [
          "did",
          "name"
        ],
        "properties": {
          "did": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "displayName": {
            "type": "string",
            "maxLength": 64
          }
        }
      },
      "recordEmbed": {
        "type": "object",
        "required": [
          "type",
          "author",
          "record"
        ],
        "properties": {
          "type": {
            "const": "record"
          },
          "author": {
            "$ref": "#/$defs/user"
          },
          "record": {
            "type": "object"
          }
        }
      },
      "externalEmbed": {
        "type": "object",
        "required": [
          "type",
          "uri",
          "title",
          "description",
          "imageUri"
        ],
        "properties": {
          "type": {
            "const": "external"
          },
          "uri": {
            "type": "string"
          },
          "title": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "imageUri": {
            "type": "string"
          }
        }
      },
      "unknownEmbed": {
        "type": "object",
        "required": [
          "type"
        ],
        "properties": {
          "type": {
            "type": "string",
            "not": {
              "enum": [
                "record",
                "external"
              ]
            }
          }
        }
      }
    }
  },
  "$ext": {
    "adxs-doc": {
      "examples": [
        {
          "feed": [
            {
              "uri": "adx://alice.com/blueskyweb.xyz:Feed/1",
              "author": {
                "did": "did:example:1234",
                "name": "alice.com",
                "displayName": "Alice"
              },
              "repostedBy": {
                "did": "did:example:1235",
                "name": "bob.com",
                "displayName": "Bob"
              },
              "record": {
                "$type": "blueskyweb.xyz:Post",
                "text": "Hello, world!",
                "createdAt": "2022-07-11T21:55:36.553Z"
              },
              "replyCount": 0,
              "repostCount": 0,
              "likeCount": 0,
              "indexedAt": "2022-07-11T21:55:36.553Z"
            },
            {
              "uri": "adx://alice.com/blueskyweb.xyz:Feed/1",
              "author": {
                "did": "did:example:1234",
                "name": "alice.com",
                "displayName": "Alice"
              },
              "record": {
                "$type": "blueskyweb.xyz:Post",
                "text": "This is a link to a post adx://bob.com/blueskyweb.xyz:Feed/1",
                "createdAt": "2022-07-11T21:55:36.553Z"
              },
              "embed": {
                "type": "record",
                "author": {
                  "did": "did:example:1235",
                  "name": "bob.com",
                  "displayName": "Bob"
                },
                "record": {
                  "$type": "blueskyweb.xyz:Post",
                  "text": "Hello, world!",
                  "createdAt": "2022-07-11T21:55:36.553Z"
                }
              },
              "replyCount": 0,
              "repostCount": 0,
              "likeCount": 0,
              "indexedAt": "2022-07-11T21:55:36.553Z"
            },
            {
              "uri": "adx://alice.com/blueskyweb.xyz:Feed/1",
              "author": {
                "did": "did:example:1234",
                "name": "alice.com",
                "displayName": "Alice"
              },
              "record": {
                "$type": "blueskyweb.xyz:Post",
                "text": "Check out my website alice.com",
                "entities": [
                  {
                    "index": [
                      21,
                      30
                    ],
                    "type": "link",
                    "value": "https://alice.com"
                  }
                ],
                "createdAt": "2022-07-11T21:55:36.553Z"
              },
              "embed": {
                "type": "external",
                "uri": "https://alice.com",
                "title": "Alice's personal website",
                "description": "Just a collection of my thoughts and feelings",
                "imageUri": "/cdn/cache/web/https-alice-com.jpeg"
              },
              "replyCount": 0,
              "repostCount": 0,
              "likeCount": 0,
              "indexedAt": "2022-07-11T21:55:36.553Z"
            },
            {
              "uri": "adx://alice.com/blueskyweb.xyz:Feed/1",
              "author": {
                "did": "did:example:1234",
                "name": "alice.com",
                "displayName": "Alice"
              },
              "record": {
                "$type": "blueskyweb.xyz:Post",
                "text": "Another test"
              },
              "embed": {
                "type": "somethingelse",
                "embedIsFutureProof": true
              },
              "replyCount": 0,
              "repostCount": 0,
              "likeCount": 0,
              "indexedAt": "2022-07-11T21:55:36.553Z"
            }
          ]
        }
      ]
    }
  }
},{
  "$type": "adxs-record",
  "author": "blueskyweb.xyz",
  "name": "Follow",
  "$comment": "A social follow",
  "locale": {
    "en-US": {
      "nameSingular": "Follow",
      "namePlural": "Follows"
    }
  },
  "schema": {
    "type": "object",
    "required": [
      "subject",
      "createdAt"
    ],
    "properties": {
      "subject": {
        "type": "string"
      },
      "createdAt": {
        "type": "string",
        "format": "date-time"
      }
    }
  },
  "$ext": {
    "adxs-doc": {
      "examples": [
        {
          "$type": "blueskyweb.xyz:Follow",
          "subject": {
            "did": "did:example:1234",
            "name": "alice.com"
          },
          "createdAt": "2022-07-11T21:55:36.553Z"
        }
      ]
    }
  }
},{
  "$type": "adxs-collection",
  "author": "blueskyweb.xyz",
  "name": "Follows",
  "$comment": "Where you put follows.",
  "locale": {
    "en-US": {
      "nameSingular": "Follows",
      "namePlural": "Follows Collections"
    }
  }
},{
  "$type": "adxs-record",
  "author": "blueskyweb.xyz",
  "name": "Like",
  "locale": {
    "en-US": {
      "nameSingular": "Like",
      "namePlural": "Likes"
    }
  },
  "schema": {
    "type": "object",
    "required": [
      "subject",
      "createdAt"
    ],
    "properties": {
      "subject": {
        "type": "string"
      },
      "createdAt": {
        "type": "string",
        "format": "date-time"
      }
    }
  },
  "$ext": {
    "adxs-doc": {
      "examples": [
        {
          "$type": "blueskyweb.xyz:Like",
          "subject": "adx://alice.com/blueskyweb.xyz:Feed/1234",
          "createdAt": "2022-07-11T21:55:36.553Z"
        }
      ]
    }
  }
},{
  "$type": "adxs-view",
  "author": "blueskyweb.xyz",
  "name": "LikedByView",
  "reads": [
    "blueskyweb.xyz:Feed",
    "blueskyweb.xyz:SocialGraph"
  ],
  "parameters": {
    "type": "object",
    "required": [
      "uri"
    ],
    "properties": {
      "uri": {
        "type": "string"
      },
      "limit": {
        "type": "number",
        "maximum": 100
      },
      "before": {
        "type": "string",
        "format": "date-time"
      }
    }
  },
  "response": {
    "type": "object",
    "required": [
      "uri",
      "likedBy"
    ],
    "properties": {
      "uri": {
        "type": "string"
      },
      "likedBy": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "did",
            "name",
            "displayName",
            "indexedAt"
          ],
          "properties": {
            "did": {
              "type": "string"
            },
            "name": {
              "type": "string"
            },
            "displayName": {
              "type": "string",
              "maxLength": 64
            },
            "createdAt": {
              "type": "string",
              "format": "date-time"
            },
            "indexedAt": {
              "type": "string",
              "format": "date-time"
            }
          }
        }
      }
    }
  },
  "$ext": {
    "adxs-doc": {
      "examples": [
        {
          "uri": "adx://alice.com/blueskyweb.xyz:Feed/1234",
          "likedBy": [
            {
              "did": "did:example:1234",
              "name": "bob.com",
              "displayName": "Bob",
              "createdAt": "2022-07-11T21:55:36.553Z",
              "indexedAt": "2022-07-11T21:55:36.553Z"
            }
          ]
        }
      ]
    }
  }
},{
  "$type": "adxs-collection",
  "author": "blueskyweb.xyz",
  "name": "Likes",
  "$comment": "Where you put likes.",
  "locale": {
    "en-US": {
      "nameSingular": "Likes",
      "namePlural": "Likes Collections"
    }
  }
},{
  "$type": "adxs-view",
  "author": "blueskyweb.xyz",
  "name": "NotificationsView",
  "reads": [
    "blueskyweb.xyz:Feed",
    "blueskyweb.xyz:SocialGraph"
  ],
  "parameters": {
    "type": "object",
    "properties": {
      "limit": {
        "type": "number",
        "maximum": 100
      },
      "before": {
        "type": "string",
        "format": "date-time"
      }
    }
  },
  "response": {
    "type": "object",
    "required": [
      "notifications"
    ],
    "properties": {
      "notifications": {
        "type": "array",
        "items": {
          "$ref": "#/$defs/notification"
        }
      }
    },
    "$defs": {
      "notification": {
        "type": "object",
        "required": [
          "uri",
          "author",
          "record",
          "isRead",
          "indexedAt"
        ],
        "properties": {
          "uri": {
            "type": "string",
            "format": "uri"
          },
          "author": {
            "type": "object",
            "required": [
              "did",
              "name",
              "displayName"
            ],
            "properties": {
              "did": {
                "type": "string"
              },
              "name": {
                "type": "string"
              },
              "displayName": {
                "type": "string",
                "maxLength": 64
              }
            }
          },
          "record": {
            "type": "object"
          },
          "isRead": {
            "type": "boolean"
          },
          "indexedAt": {
            "type": "string",
            "format": "date-time"
          }
        }
      }
    }
  }
},{
  "$type": "adxs-record",
  "author": "blueskyweb.xyz",
  "name": "Post",
  "locale": {
    "en-US": {
      "nameSingular": "Post",
      "namePlural": "Posts"
    }
  },
  "schema": {
    "type": "object",
    "required": [
      "text",
      "createdAt"
    ],
    "properties": {
      "text": {
        "type": "string",
        "maxLength": 256
      },
      "entities": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "index",
            "type",
            "value"
          ],
          "properties": {
            "index": {
              "$ref": "#/$defs/textSlice"
            },
            "type": {
              "type": "string",
              "$comment": "Expected values are 'mention', 'hashtag', and 'link'."
            },
            "value": {
              "type": "string"
            }
          }
        }
      },
      "reply": {
        "type": "object",
        "required": [
          "root"
        ],
        "properties": {
          "root": {
            "type": "string"
          },
          "parent": {
            "type": "string"
          }
        }
      },
      "createdAt": {
        "type": "string",
        "format": "date-time"
      }
    },
    "$defs": {
      "textSlice": {
        "type": "array",
        "items": [
          {
            "type": "number"
          },
          {
            "type": "number"
          }
        ],
        "minItems": 2,
        "maxItems": 2
      }
    }
  },
  "$ext": {
    "adxs-doc": {
      "examples": [
        {
          "$type": "blueskyweb.xyz:Post",
          "text": "Hello, world!",
          "createdAt": "2022-07-11T21:55:36.553Z"
        },
        {
          "$type": "blueskyweb.xyz:Post",
          "text": "This is a reply to a post",
          "reply": {
            "root": "adx://alice.com/blueskyweb.xyz:Feed/1",
            "parent": "adx://bob.com/blueskyweb.xyz:Feed/9"
          },
          "createdAt": "2022-07-11T21:55:36.553Z"
        },
        {
          "$type": "blueskyweb.xyz:Post",
          "text": "Hey @bob.com, are we #CrushingIt or what? Check out my website alice.com",
          "entities": [
            {
              "index": [
                4,
                12
              ],
              "type": "mention",
              "value": "did:example:1234"
            },
            {
              "index": [
                21,
                32
              ],
              "type": "hashtag",
              "value": "CrushingIt"
            },
            {
              "index": [
                63,
                72
              ],
              "type": "link",
              "value": "https://alice.com"
            }
          ],
          "createdAt": "2022-07-11T21:55:36.553Z"
        },
        {
          "$type": "blueskyweb.xyz:Post",
          "text": "This post embeds an image!",
          "$ext": {
            "blueskyweb.xyz:EmbeddedMedia": {
              "media": [
                {
                  "alt": "Me at the beach",
                  "thumb": {
                    "mimeType": "image/png",
                    "blobId": "1234"
                  },
                  "original": {
                    "mimeType": "image/png",
                    "blobId": "1235"
                  }
                }
              ]
            }
          },
          "createdAt": "2022-07-11T21:55:36.553Z"
        }
      ]
    }
  }
},{
  "$type": "adxs-view",
  "author": "blueskyweb.xyz",
  "name": "PostThreadView",
  "reads": [
    "blueskyweb.xyz:Feed",
    "blueskyweb.xyz:SocialGraph"
  ],
  "parameters": {
    "type": "object",
    "required": [
      "uri"
    ],
    "properties": {
      "uri": {
        "type": "string"
      },
      "depth": {
        "type": "number"
      }
    }
  },
  "response": {
    "type": "object",
    "required": [
      "thread"
    ],
    "properties": {
      "thread": {
        "$ref": "#/$defs/post"
      }
    },
    "$defs": {
      "post": {
        "type": "object",
        "required": [
          "uri",
          "author",
          "record",
          "replyCount",
          "likeCount",
          "repostCount",
          "indexedAt"
        ],
        "properties": {
          "uri": {
            "type": "string"
          },
          "author": {
            "$ref": "#/$defs/user"
          },
          "record": {
            "type": "object"
          },
          "embed": {
            "oneOf": [
              {
                "$ref": "#/$defs/recordEmbed"
              },
              {
                "$ref": "#/$defs/externalEmbed"
              },
              {
                "$ref": "#/$defs/unknownEmbed"
              }
            ]
          },
          "parent": {
            "$ref": "#/$defs/post"
          },
          "replyCount": {
            "type": "number"
          },
          "replies": {
            "type": "array",
            "items": {
              "$ref": "#/$defs/post"
            }
          },
          "likeCount": {
            "type": "number"
          },
          "repostCount": {
            "type": "number"
          },
          "indexedAt": {
            "type": "string",
            "format": "date-time"
          },
          "myState": {
            "type": "object",
            "properties": {
              "repost": {
                "type": "string"
              },
              "like": {
                "type": "string"
              }
            }
          }
        }
      },
      "user": {
        "type": "object",
        "required": [
          "did",
          "name"
        ],
        "properties": {
          "did": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "displayName": {
            "type": "string",
            "maxLength": 64
          }
        }
      },
      "recordEmbed": {
        "type": "object",
        "required": [
          "type",
          "author",
          "record"
        ],
        "properties": {
          "type": {
            "const": "record"
          },
          "author": {
            "$ref": "#/$defs/user"
          },
          "record": {
            "type": "object"
          }
        }
      },
      "externalEmbed": {
        "type": "object",
        "required": [
          "type",
          "uri",
          "title",
          "description",
          "imageUri"
        ],
        "properties": {
          "type": {
            "const": "external"
          },
          "uri": {
            "type": "string"
          },
          "title": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "imageUri": {
            "type": "string"
          }
        }
      },
      "unknownEmbed": {
        "type": "object",
        "required": [
          "type"
        ],
        "properties": {
          "type": {
            "type": "string",
            "not": {
              "enum": [
                "record",
                "external"
              ]
            }
          }
        }
      }
    }
  },
  "$ext": {
    "adxs-doc": {
      "examples": [
        {
          "thread": {
            "uri": "adx://alice.com/blueskyweb.xyz:Feed/1",
            "author": {
              "did": "did:example:1234",
              "name": "alice.com",
              "displayName": "Alice"
            },
            "repostedBy": {
              "did": "did:example:1235",
              "name": "bob.com",
              "displayName": "Bob"
            },
            "record": {
              "$type": "blueskyweb.xyz:Post",
              "text": "Hello, world!",
              "createdAt": "2022-07-11T21:55:36.553Z"
            },
            "replyCount": 3,
            "repostCount": 0,
            "likeCount": 0,
            "indexedAt": "2022-07-11T21:55:36.553Z",
            "replies": [
              {
                "uri": "adx://alice.com/blueskyweb.xyz:Feed/2",
                "author": {
                  "did": "did:example:1234",
                  "name": "alice.com",
                  "displayName": "Alice"
                },
                "record": {
                  "$type": "blueskyweb.xyz:Post",
                  "text": "This is a link to a post adx://bob.com/blueskyweb.xyz:Feed/1",
                  "createdAt": "2022-07-11T21:55:36.553Z"
                },
                "embed": {
                  "type": "record",
                  "author": {
                    "did": "did:example:1235",
                    "name": "bob.com",
                    "displayName": "Bob"
                  },
                  "record": {
                    "$type": "blueskyweb.xyz:Post",
                    "text": "Hello, world!",
                    "createdAt": "2022-07-11T21:55:36.553Z"
                  }
                },
                "replyCount": 1,
                "repostCount": 0,
                "likeCount": 0,
                "indexedAt": "2022-07-11T21:55:36.553Z",
                "replies": [
                  {
                    "uri": "adx://alice.com/blueskyweb.xyz:Feed/3",
                    "author": {
                      "did": "did:example:1234",
                      "name": "alice.com",
                      "displayName": "Alice"
                    },
                    "record": {
                      "$type": "blueskyweb.xyz:Post",
                      "text": "Another test"
                    },
                    "embed": {
                      "type": "somethingelse",
                      "embedIsFutureProof": true
                    },
                    "replyCount": 0,
                    "repostCount": 0,
                    "likeCount": 0,
                    "indexedAt": "2022-07-11T21:55:36.553Z"
                  }
                ]
              },
              {
                "uri": "adx://alice.com/blueskyweb.xyz:Feed/4",
                "author": {
                  "did": "did:example:1234",
                  "name": "alice.com",
                  "displayName": "Alice"
                },
                "record": {
                  "$type": "blueskyweb.xyz:Post",
                  "text": "Check out my website alice.com",
                  "entities": [
                    {
                      "index": [
                        21,
                        30
                      ],
                      "type": "link",
                      "value": "https://alice.com"
                    }
                  ],
                  "createdAt": "2022-07-11T21:55:36.553Z"
                },
                "embed": {
                  "type": "external",
                  "uri": "https://alice.com",
                  "title": "Alice's personal website",
                  "description": "Just a collection of my thoughts and feelings",
                  "imageUri": "/cdn/cache/web/https-alice-com.jpeg"
                },
                "replyCount": 0,
                "repostCount": 0,
                "likeCount": 0,
                "indexedAt": "2022-07-11T21:55:36.553Z"
              }
            ]
          }
        }
      ]
    }
  }
},{
  "$type": "adxs-collection",
  "author": "blueskyweb.xyz",
  "name": "Posts",
  "$comment": "Where you put posts and reposts.",
  "locale": {
    "en-US": {
      "nameSingular": "Posts",
      "namePlural": "Posts Collections"
    }
  }
},{
  "$type": "adxs-record",
  "author": "blueskyweb.xyz",
  "name": "Profile",
  "locale": {
    "en-US": {
      "nameSingular": "Profile",
      "namePlural": "Profiles"
    }
  },
  "schema": {
    "type": "object",
    "required": [
      "displayName"
    ],
    "properties": {
      "displayName": {
        "type": "string",
        "maxLength": 64
      },
      "description": {
        "type": "string",
        "maxLength": 256
      },
      "badges": {
        "type": "array",
        "items": {
          "$ref": "#/$defs/badgeRef"
        }
      }
    },
    "$defs": {
      "badgeRef": {
        "type": "object",
        "required": [
          "uri"
        ],
        "properties": {
          "uri": {
            "type": "string"
          }
        }
      }
    }
  },
  "$ext": {
    "adxs-doc": {
      "examples": [
        {
          "$type": "blueskyweb.xyz:Profile",
          "displayName": "Alice",
          "description": "A cool hacker chick",
          "badges": [
            {
              "uri": "adx://bob.com/blueskyweb.xyz:Social/1234"
            }
          ]
        }
      ]
    }
  }
},{
  "$type": "adxs-view",
  "author": "blueskyweb.xyz",
  "name": "ProfileView",
  "reads": [
    "blueskyweb.xyz:Feed",
    "blueskyweb.xyz:SocialGraph"
  ],
  "parameters": {
    "type": "object",
    "required": [
      "user"
    ],
    "properties": {
      "user": {
        "type": "string"
      }
    }
  },
  "response": {
    "type": "object",
    "required": [
      "did",
      "name",
      "displayName",
      "description",
      "followersCount",
      "followsCount",
      "postsCount",
      "badges"
    ],
    "properties": {
      "did": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "displayName": {
        "type": "string",
        "maxLength": 64
      },
      "description": {
        "type": "string",
        "maxLength": 256
      },
      "followersCount": {
        "type": "number"
      },
      "followsCount": {
        "type": "number"
      },
      "postsCount": {
        "type": "number"
      },
      "badges": {
        "type": "array",
        "items": {
          "$ref": "#/$defs/badge"
        }
      },
      "myState": {
        "type": "object",
        "properties": {
          "follow": {
            "type": "string"
          }
        }
      }
    },
    "$defs": {
      "badge": {
        "type": "object",
        "required": [
          "uri"
        ],
        "properties": {
          "uri": {
            "type": "string"
          },
          "error": {
            "type": "string"
          },
          "issuer": {
            "type": "object",
            "required": [
              "did",
              "name",
              "displayName"
            ],
            "properties": {
              "did": {
                "type": "string"
              },
              "name": {
                "type": "string"
              },
              "displayName": {
                "type": "string",
                "maxLength": 64
              }
            }
          },
          "assertion": {
            "type": "object",
            "required": [
              "type"
            ],
            "properties": {
              "type": {
                "type": "string"
              }
            }
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          }
        }
      }
    }
  },
  "$ext": {
    "adxs-doc": {
      "examples": [
        {
          "did": "did:example:1234",
          "name": "alice.com",
          "displayName": "Alice",
          "description": "A cool hacker chick",
          "followersCount": 1000,
          "followsCount": 100,
          "postsCount": 250,
          "badges": [
            {
              "uri": "adx://work.com/blueskyweb.xyz:Social/1234",
              "issuer": {
                "did": "did:example:4321",
                "name": "work.com",
                "displayName": "Work"
              },
              "assertion": {
                "type": "employee"
              },
              "createdAt": "2010-01-01T19:23:24Z"
            },
            {
              "uri": "adx://bob.com/blueskyweb.xyz:Social/2222",
              "issuer": {
                "did": "did:example:5555",
                "name": "bob.com",
                "displayName": "Bob"
              },
              "assertion": {
                "type": "tag",
                "tag": "tech"
              },
              "createdAt": "2010-01-01T19:23:24Z"
            }
          ]
        }
      ]
    }
  }
},{
  "$type": "adxs-collection",
  "author": "blueskyweb.xyz",
  "name": "Profiles",
  "$comment": "Where you put your profile.",
  "locale": {
    "en-US": {
      "nameSingular": "Profiles",
      "namePlural": "Profiles Collections"
    }
  }
},{
  "$type": "adxs-record",
  "author": "blueskyweb.xyz",
  "name": "Repost",
  "locale": {
    "en-US": {
      "nameSingular": "Repost",
      "namePlural": "Reposts"
    }
  },
  "schema": {
    "type": "object",
    "required": [
      "subject",
      "createdAt"
    ],
    "properties": {
      "subject": {
        "type": "string"
      },
      "createdAt": {
        "type": "string",
        "format": "date-time"
      }
    }
  },
  "$ext": {
    "adxs-doc": {
      "examples": [
        {
          "$type": "blueskyweb.xyz:Repost",
          "subject": "adx://alice.com/blueskyweb.xyz:Feed/1234",
          "createdAt": "2022-07-11T21:55:36.553Z"
        }
      ]
    }
  }
},{
  "$type": "adxs-view",
  "author": "blueskyweb.xyz",
  "name": "RepostedByView",
  "reads": [
    "blueskyweb.xyz:Feed",
    "blueskyweb.xyz:SocialGraph"
  ],
  "parameters": {
    "type": "object",
    "required": [
      "uri"
    ],
    "properties": {
      "uri": {
        "type": "string"
      },
      "limit": {
        "type": "number",
        "maximum": 100
      },
      "before": {
        "type": "string",
        "format": "date-time"
      }
    }
  },
  "response": {
    "type": "object",
    "required": [
      "uri",
      "repostedBy"
    ],
    "properties": {
      "uri": {
        "type": "string"
      },
      "repostedBy": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "did",
            "name",
            "displayName",
            "indexedAt"
          ],
          "properties": {
            "did": {
              "type": "string"
            },
            "name": {
              "type": "string"
            },
            "displayName": {
              "type": "string",
              "maxLength": 64
            },
            "createdAt": {
              "type": "string",
              "format": "date-time"
            },
            "indexedAt": {
              "type": "string",
              "format": "date-time"
            }
          }
        }
      }
    }
  },
  "$ext": {
    "adxs-doc": {
      "examples": [
        {
          "uri": "adx://alice.com/blueskyweb.xyz:Feed/1234",
          "repostedBy": [
            {
              "did": "did:example:1234",
              "name": "bob.com",
              "displayName": "Bob",
              "createdAt": "2022-07-11T21:55:36.553Z",
              "indexedAt": "2022-07-11T21:55:36.553Z"
            }
          ]
        }
      ]
    }
  }
},{
  "$type": "adxs-view",
  "author": "blueskyweb.xyz",
  "name": "UserFollowersView",
  "$comment": "Who is following a user?",
  "reads": [
    "blueskyweb.xyz:SocialGraph"
  ],
  "parameters": {
    "type": "object",
    "required": [
      "user"
    ],
    "properties": {
      "user": {
        "type": "string"
      },
      "limit": {
        "type": "number",
        "maximum": 100
      },
      "before": {
        "type": "string",
        "format": "date-time"
      }
    }
  },
  "response": {
    "type": "object",
    "required": [
      "subject",
      "followers"
    ],
    "properties": {
      "subject": {
        "type": "object",
        "required": [
          "did",
          "name"
        ],
        "properties": {
          "did": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "displayName": {
            "type": "string",
            "maxLength": 64
          }
        }
      },
      "followers": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "did",
            "name",
            "indexedAt"
          ],
          "properties": {
            "did": {
              "type": "string"
            },
            "name": {
              "type": "string"
            },
            "displayName": {
              "type": "string",
              "maxLength": 64
            },
            "createdAt": {
              "type": "string",
              "format": "date-time"
            },
            "indexedAt": {
              "type": "string",
              "format": "date-time"
            }
          }
        }
      }
    }
  },
  "$ext": {
    "adxs-doc": {
      "examples": [
        {
          "subject": {
            "did": "did:example:1235",
            "name": "alice.com",
            "displayName": "Alice"
          },
          "followers": [
            {
              "did": "did:example:1234",
              "name": "bob.com",
              "displayName": "Bob",
              "createdAt": "2022-07-11T21:55:36.553Z",
              "indexedAt": "2022-07-11T21:55:36.553Z"
            }
          ]
        }
      ]
    }
  }
},{
  "$type": "adxs-view",
  "author": "blueskyweb.xyz",
  "name": "UserFollowsView",
  "$comment": "Who is a user following?",
  "reads": [
    "blueskyweb.xyz:SocialGraph"
  ],
  "parameters": {
    "type": "object",
    "required": [
      "user"
    ],
    "properties": {
      "user": {
        "type": "string"
      },
      "limit": {
        "type": "number",
        "maximum": 100
      },
      "before": {
        "type": "string",
        "format": "date-time"
      }
    }
  },
  "response": {
    "type": "object",
    "required": [
      "subject",
      "follows"
    ],
    "properties": {
      "subject": {
        "type": "object",
        "required": [
          "did",
          "name"
        ],
        "properties": {
          "did": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "displayName": {
            "type": "string",
            "maxLength": 64
          }
        }
      },
      "follows": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "did",
            "name",
            "indexedAt"
          ],
          "properties": {
            "did": {
              "type": "string"
            },
            "name": {
              "type": "string"
            },
            "displayName": {
              "type": "string",
              "maxLength": 64
            },
            "createdAt": {
              "type": "string",
              "format": "date-time"
            },
            "indexedAt": {
              "type": "string",
              "format": "date-time"
            }
          }
        }
      }
    }
  },
  "$ext": {
    "adxs-doc": {
      "examples": [
        {
          "subject": {
            "did": "did:example:1235",
            "name": "alice.com",
            "displayName": "Alice"
          },
          "follows": [
            {
              "did": "did:example:1234",
              "name": "bob.com",
              "displayName": "Bob",
              "createdAt": "2022-07-11T21:55:36.553Z",
              "indexedAt": "2022-07-11T21:55:36.553Z"
            }
          ]
        }
      ]
    }
  }
}]