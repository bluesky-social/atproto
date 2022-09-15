# NameSpaced IDs (NSIDs)

NameSpaced IDs (NSIDs) are used throughout ADX to identify methods, records types, and other semantic information.

NSIDs use [Reverse Domain-Name Notation](https://en.wikipedia.org/wiki/Reverse_domain_name_notation) with the additional constraint that the segments prior to the final segment *must* map to a valid domain name. For instance, the owner of `example.com` could use the ID of `com.example.foo` but could not use `com.example.foo.bar` unless they also control `foo.example.com`. These rules are to ensure that schemas are globally unique, have a clear authority mapping (to a registered domain), and can potentially be resolved by request.

Some example NSIDs:

```
com.example.status
io.social.getFeed
net.users.bob.ping
```

## Grammar

```
alpha     = "a" / "b" / "c" / "d" / "e" / "f" / "g" / "h" / "i" / "j" / "k" / "l" / "m" / "n" / "o" / "p" / "q" / "r" / "s" / "t" / "u" / "v" / "w" / "x" / "y" / "z" / "A" / "B" / "C" / "D" / "E" / "F" / "G" / "H" / "I" / "J" / "K" / "L" / "M" / "N" / "O" / "P" / "Q" / "R" / "S" / "T" / "U" / "V" / "W" / "X" / "Y" / "Z"
number    = "1" / "2" / "3" / "4" / "5" / "6" / "7" / "8" / "9" / "0"
delim     = "."
segment   = alpha *( alpha / number / "-" )
authority = segment *( delim segment )
name      = segment
nsid      = authority delim name
nsid-ns   = authority delim "*"
```

The `nsid-ns` (a "namespace") can be used in certain situations to designate all names under a namespace, eg `com.example.*`.

## Authority model

Every NSID asserts a single authority which is identified as the segments prior to the final segment which are then reversed.

```
com.example.thing
^^^^^^^^^^^--------> example.com
```

The authority controls the namespace of all names within it, however there is no hierarchy or relationship between authorities. That is, the domain `example.com` does not hold any authority over `sub.example.com`, and therefore `com.example.*` is considered completely independent of `com.example.sub.*`.

## Parsing

NSIDs are comprised of an "authority" and a "name".

The domain can be extracted through the following algorithm:

```js
function getNSIDAuthority (nsid) {
  // split the nsid into segments
  const parts = nsid.split('.')
  // remove the last segment
  parts.pop()
  // reverse the order of the segments
  parts.reverse()
  // rejoin the segments
  return parts.join('.')
}
```

Some example resolutions of NSIDs to authorities:

```
com.example.status -> example.com
io.social.getFeed  -> social.io
net.users.bob.ping -> bob.user.net
```

The name can be extracted through the following algorithm:

```js
function getNSIDName (nsid) {
  // split the nsid into segments
  const parts = nsid.split('.')
  // return the last segment
  return parts.pop()
}
```

Some example resolutions of NSIDs to names:

```
com.example.status -> status
io.social.getFeed  -> getFeed
net.users.bob.ping -> ping
```