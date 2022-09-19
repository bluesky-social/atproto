# did:plc
DID Placeholder (PLC)

**Identifier** because the did:cid: are keys that can be used to identify repositories.

The word **Consortium** is used here simply to mean a consensus group. It could be a single server, a reliability algorithm like Paxos or Raft, a Byzantine fault tolerance algorithm, or a full public Leger protocol. The point being it is a group that comes to consensus.

## Why a consortium?
At its heart the consortium is there for two reasons. 

1. The first and primary is that we want an ability to transfer control of a repo to a new controller without any ability of the previous controller to reclaim the repository.

2. The second is we want to be able to reliably resolve a DID to a repository with nothing but the DID string.

> Note: You don’t need to register your DID with a consortium unless you need one or both of these properties.

### Transfer
In order to be able to transfer a repository from one controller to another we need the key that controls the repository to be able to sign over the repository to a new controller. This new controller could be Identified by a new key or a DID that eventually leads to a key.

The problem arises from the fact that the current controller of the repository could sign two updates transferring control or simply keep publishing updates as of an old version of the DID document. This is sometimes referred to as duplicity. The cryptocurrency world knows this as the double spend problem.

In order to resolve this problem we apply a rule such as first writer wins. Whichever update came first is the new controller of the repository and whichever update came second is not a valid update. The second controller does not receive control of the repository.

In order to implement first writer wins we require the writes to be in an order so that “first” update is defined.

This ordering is why we need a consortium. We do not intend for this consortium to be a corporation for assigned names and numbers but simply to be the consensus group that agrees on the ordering of events that transfer control of a repository.

The transfer of control will not be considered valid until the consortium accepts the transfer and the consortium will not accept conflicting transfers. Any subsequent transfer must be signed by the new controller.

When a repo is transferred previous controllers rights over the repository are exhausted.

#### Recovery
Our algorithm is slightly different from the "first writer wins". We support the concept of a Recovery key. In the event that an attacker manages to steal your key they could rotate the controller and lock you out of your repository. In order to recover from this scenario we allow the recovery key to rotate the controller even if it has already been revoked.

This allows for recovering a stolen repository but would prevent the repo from being transferred as the previous owner could use the recovery key to recover the repo after transferring it to the new controller.


We balance this tradeoff with the 72 hour window. By allowing the recovery key to be used even after the controller rotates the recovery key we allow the controller to recover from a stolen key but once the 72 hour window expires the recovery key is rotated finally and the previous controllers rights over the repository are exhausted. The shorter the window the faster transfers can be finalized the longer the window the more time a controller has to detect the theft and reverse it.

We believe the 72 hour window is a good default window to balance this tradeoff.

This means that the consortium's consensus algorithm must provide not just a consensus order but consensus timestamps.

### Resolution
We also want to be able to resolve DID strings to DID documents. If a repository owner wishes to use a `did:plc:` string as their repository DID they will need to submit their origin DID document to the consortium as part of their repo init. 
Each DID method specifies its own way to resolve a DID string to its respective DID document.
PLC acts as a DID registry for the `did:plc:` did method. The consortium members operate nodes that both perform the consensus and answer queries for the latest DID documents for a given did string.

Each member of the consortium should be able to resolve any `did:plc:` to a DID document without needing to send traffic to the other consortium members. A consortium member has consensus as of some timestamp. When a consortium member receives a query it responds with the state of the DID Document as of the last consensus timestamp. This still applies when the consortium member responds that there is no such DID document for that DID string. There may be a document as of later consensus time but as of the returned consensus time there will never be a DID document for that DID string. This means that any node can answer immediately.

### The need for total order
Whether the application is trying to resolve the latest version of the doc or to transfer the control of the DID the application is depending on the consortium to provide a total ordering and consensus timestamps.
There are two keys in the Did doc.
The Account Key is for controlling the repo but can also be used to update the DID document itself.
The Recovery key can’t directly be used to control the repo but can be used to update the DID document.
Either key can replace the other.
So we have an inherent race condition.

If the owner of the repo has an account key but trusts a key escrow to perform the key recovery they need a way to switch key escrows or even switch to managing their own recovery key. On the other side if you get hacked and the attacker updated your DID Document you need a way to recover the repository. We use the Recovery key to recover control of repos.

These contradictory goals are accomplished by using a synchronous component to the system. By setting a time limit for the Recovery key to contest a DID document update. For example we might say that after an account key updates the DID document the recovery key has 72 hours to contest the update by rotating the account key. In the event that the key escrow detects a change to the recovery key it can contact the repo owner to determine if this was intended. If they were hacked then the key escrow reveals the recovery key to the owner. The owner can use the recovery key to update the DID Document and lock out the hacker. If the timer runs out then the recovery key is no longer valid and the key escrow update is complete. In this way some old key escrow can’t be compromised and rotate your keys out from under you. As long as the key escrow does not dishonestly rotate your keys in the window you are no longer trusting them.

This pattern is the key to allowing services that set up a DID for each customer as part of the signup flow for low friction but also empower users to take on more responsibilities as they value the repo more. On day one using a social network it may not be worth it for users to install a client. It may be better to just let the service control both the account and recovery keys. Once I have been using it for some time I may want to take control of my own account key only allowing devices authorized by me to post. If the service tries to take over the account from me there will be a public record of the key rotation by the recovery key. If the user then wants to move from the service provider to a key escrow of their choice then they simply update the DID document with the new recovery key. Now they are not dependent on the service provider for recovery but the key escrow of their choosing. They have taken full responsibility for their own repo.
All this depends on the ability to agree on the order of actions.

Which came first of two competing account key rotations. Which came first of two competing recovery key rotations. Which came first of a recovery key rotation or 72 hours after an account key rotation. This ordering and timestamping is the value added by the consortium. It does not need the power to update documents just to witness that the DID Document patches were submitted to the consortium in some order.
Do to the fact that it takes ⌊⅔⌋ +1 of the consortium members to accept a patch. There will be some latency from when the first member receives the patch, to when the patch is final, to when all members are aware of the final patch. However, each member node will have its own copy of the history and can answer queries as of its local latest final timestamp.

## The DID
### DID String Format
`did:plc:<pid>`

E.g.

`did:plc:vbazpoyabpjpebvnxrrpq7bv`

`did:plc:<pid>?k=did:key:123&h=`[`<ip>:<port>`](https://multiformats.io/multiaddr/)

The DID string is the root of trust for a DID. 
The DID string can be parameterised to send the resolver to a consortium that has the DID document. 
* k (consortium key)
  * A did key that signs the identity ticks
  * If k is included in the DID string but h is not:
    * look in the config for the corresponding home server.
* h (consortium home server)
  * The location of the home server
  * If h is included in the DID string but k is not:
    * First look in the config for the corresponding consortium key
    * Else trust any identity tick whose retrieval can be validated i.g. https
* In order to have an authoritative current version of the DID document we need a consensus group to serve as the authority. The parameters k,h specifies the authority for the atomic updates of the consortium.
* If k or h are not specified then the default PLC server is used.
  * A server may choose to limit the did:plc keys that they will allow.
* initialState-param
  * See https://www.w3.org/TR/did-spec-registries/#initialState-param
  * Used when a DID is not yet registered

### Document
  A repository needs to have several values in the DID Document
* Home location: Location of a server with a full clone of the repo.
* Recovery key: A key that can rotate keys in this document.
* Account key: A key that can update the DID Document in any way, sign the repos commits.
* Tick key: A key of a consensus group which accepts the latest repo commit. The atom server signs the ticks.
```json
{
   "@context": [
       "https://www.w3.org/ns/did/v1",
       "https://adx.example.com/",
       "https://w3id.org/security/suites/ed25519-2018/v1",
   ],
   "id": "did:plc:vbazpoyabpjpebvnxrrpq7bv",
   "controller":"",
   "service": [
       {
           "id": "did:example:123#adx-home",
           "type": "adx-home",
           "serviceEndpoint":"<url or ip of home server>"
       }, {
           "id": "did:example:123#adx-account",
           "type": "adx-account",
           "serviceEndpoint": "pfrazee.com"
       }
   ],
   "adx/tick_key": [
     "did:key:zDnaeUseLF7DyBMA4mNdCKFk8457HAV1zpYmmHDt8L9PB3GY9"
   ],
   "adx/account_key": [
     "did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez"
   ],
   "adx/recovery_key": [
     "did:key:zDnaepvdtQ3jDLU15JihZwmMghuRugJArN8x9rm6Czt9BkHEM"
   ],
}
```

### Resolution
The DID string is the prefix `did:plc:` and a suffix that is a hash of the DID documents origin diff.
The Origin diff is the first diff.

#### Phase 1: Retrieve the diff list.
When resolving the DID string, call any of the consortium members to retrieve the list of diffs.
The diffs are ordered.
The consortium member will reply with a data structure containing:
* List of diffs and their corresponding consensus timestamps.
<!-- 
* List of pending diffs that have not yet reached consensus and their corresponding observation timestamps by the consortium member. 
-->
* The consensus timestamp of the most recent consensus.

  > Note: This may be considerably more recent then the most recent consensus timestamp of a diff if the document has not changed recently.
  >
  > The consortium is expected to reach consensus several times a second and the documents to be updated rarely.

This data is sufficient to generate the DID document as of the most recent consensus timestamp.
<!-- and a candidate future DID document that is inconsistent between consortium members. -->

#### Phase 2: Validate the origin diff
* Take the sha256 of the origin diff.
* Encode that hash as a pid120. 
* Compare the hash with the pid120 that was found in the did.
  * If the DID string only contains the pid80, only compare the pid80.
* If they match, the first diff is authenticated by the DID string.

```python
In [1]: hash = s32(Sha256(origin_diff))
Out[1]: 2222bazpoyabpjpebvnxrrpq7bv6lls5pubxmpvgoxmr4gwmka72

In [2]: compressed = compress(hash)
Out[2]: vbazpoyabpjpebvnxrrpq7bv6lls5pubxmpvgoxmr4gwmka72

In [3]: pid120 = compressed[0:24]
Out[3]: vbazpoyabpjpebvnxrrpq7bv 

In [4]: pid80 = compressed[0:16]
Out[4]: vbazpoyabpjpebvn
```

#### Phase 3: Apply the init diffs
Once the origin diff is validated we apply the diff to add the id itself to the DID document.
  * apply the origin diff itself to the document
  * add the id
    * `[“put”, “id”, “did:plc:<origin diff pid>”]`

#### Phase 4: Apply the signed diffs
The rest of the diffs in the list are signed by a key.
* For each of the diffs in the list:
  * Check that the diff signature is valid.
    * If the signature is not valid then discard the diff.
  * Check that the diff is signed by an account key or a recovery key in the DID document. 
    * If the key is not in the lists of AccountKeys or RecoveryKeys then discard the diff.
  * Check that the key can mutate the relevant values in the doc.
    * Recovery keys may mutate the account keys or recovery keys.
    * The account key may mutate any value in the DID Document.
    * If the key does not have permission to mutate the field discard the diff.
  * Apply the diff to the document and continue to the next diff.
  * Check for recovery. 
    * If recovery repay the transaction with the recovery diff inserted 72 hours earlier then the consensus time stamp on the recovery diff.

If a key is used but has been removed by an earlier diff then check if the removed key is higher trust than the key that removed it. The priority of keys is that all recovery keys are higher priority than all account keys. Within the list of keys, either recovery keys or account keys, the earlier key is priority over the later key. A higher priority key can be used to remove a lower priority key for 72 hours after it has been removed. If that happens we need to rewind and replay the diff with that key removed.

After the window has elapsed the higher priority key is removed and has no remaining rights. Removing lower priority keys is instant and has no window.

All the timestamps for diffs are provided by the consortium’s consensus algorithm, not the clients who sign the diffs. The clients submit signed diffs to any consortium member and the timestamps are not added until the consortium reaches consensus.

#### Phase 5: Return the DID document
Once all the diffs are applied we have the version of the document as of the last consortium timestamp. We return to the caller the DID document and the as_of timestamp.

<!--
#### Phase 6: Optional peek at possible future.
There may be diffs that have not yet reached consensus by the consortium but the consortium member has seen. For example a key may have been added or removed but not yet reached consensus. Should you trust a key that has already been revoked and you have a signed diff to that effect? We should not trust a key that has been added but has not reached consensus. There may be cases where a fail safe behavior may lead to acting on candidate futures faster than they actually arrive.
A candidate future with all the diffs that have been seen by the consortium member but not yet reached consensus can be applied in the order the consortium member’s node witnessed the diffs. Despite the fact that they may be in a different order once the consortium reaches consensus.
This candidate future is an optional return from running the DID document reconstruction.
> WARNING: This candidate's future is not consistent between consortium members.
-->

### Did Document Diffs

The first diff is the origin diff; it is not validated with a signature but with the hash from the DID string. This is the original state of the DID document but without the “id” field. The ID can not be filled out since it includes the hash of the original state.

```json
{
   "@context": [ ... ],
   "Controller": ...,
   "service": [
       {
           "id": "did:example:123#adx-home",
           "type": "adx-home",
           "serviceEndpoint": ...
       },
   ],
   "adx/tick_key": [
     "did:key:zDnaeUseLF7DyBMA4mNdCKFk8457HAV1zpYmmHDt8L9PB3GY9"
   ],
   "adx/account_key": [
     "did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez"
   ],
   "adx/recovery_key": [
     "did:key:zDnaepvdtQ3jDLU15JihZwmMghuRugJArN8x9rm6Czt9BkHEM"
   ],
}
```
The second diff is implied.
Once we have the original state of the document.
We implicitly apply a diff that puts the `did:plc:<pid>` in the document as the ID field
```json
"patches":[
    ["put", "id", did:plc:<pid of origin diff>]
]
```
All subsequent diffs are validated by an account_key in the current DID document.
```json
{
  "prev": tid,
  "patches":[
    ["put", path, value],
    ["del", path, value],
  ],
  "key": "did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez",
  "sig": ""
}
```
Types of patches.
* Put: Set a key to a value
* Del: Delate a key value pair

Run the diffs in tid order.
If the `"prev": tid` is not the tid of the last diff then the diff is rejected. Even a diff that is doing recovery will be descended from the diff that it is invalidating. 

When retrieving the diffs from the consortium they will be in a `dict[tid] -> diff`

```json
{
 tid0: {
   ... the original state of document minus “id” field ...
 },
 tid1:{
   "prev": tid0,
   "patches":[
     ["put", path, value],
     ["del", path, value],
   ],
   "key": "",
   "sig": ""
 },
   tid1:{
   "prev": tid1,
   "patches":[
     ["put", path, value],
     ["del", path, value],
   ],
   "key": "",
   "sig": ""
 }
}
```

The diff can be sorted by tid and then applied one at a time until the current document state is reached.

> Note: the tids are not part of the diffs. They are added by the consortium when it reaches consensus.
> 
> The tids are the consensus time stamps that are used to calculate the 72 recovery period.

```json
{
  "tid": tid_tick,
  "diffs": {
    tid0: {... the original state - “id”},
    tid1: {... update},
    tid2: {... update}
  },
  "key": "",
  "sig": ""
}
```

The ID_Tick is a set of diffs keyed by the tid from the consensus and signed by the consensus group.

In the event that two ticks disagree the one with the higher tid is controlling.

```json
{
    "tid": "3j6c-moo-3wh2-22",
    "did": "did:plc:z357qfujmr5mgy3k",
    "diffs": {
        "3j6c-mds-hptk-22": {
            "nonce": 517206044397114,
            "a": 1,
            "b": 2,
            "c": 3,
            "adx/account_keys": [
                "did:key:zDnaeycJUNQugcrag1WmLePtK9agLYLyXvscnQM4FHm1ASiRV"
            ]
        },
        "3j6c-mds-hyms-22": {
            "prev": "3j6c-mds-hptk-22",
            "patches": [ [ "put", [ "d" ], 4 ]],
            "key":
                "did:key:zDnaeycJUNQugcrag1WmLePtK9agLYLyXvscnQM4FHm1ASiRV",
            "sig": "zwgrhEM1zotdAk791BMjAX4x2hcuAjdRsAjrxZgRZ9guWRVAk9TSRwkmaDa1Y9cUNYhPsNKACbYH1ycuuQgjHu8v"
        },
        "3j6c-mds-in52-22": {
            "prev": "3j6c-mds-hyms-22",
            "patches": [ [ "del", [ "b" ] ] ],
            "key":
                "did:key:zDnaeycJUNQugcrag1WmLePtK9agLYLyXvscnQM4FHm1ASiRV",
            "sig":
                "zsUgZFzUu4rXHzZ1rrL3EAbr26iLNUKURAW9sB1duZfpUb6u9kWdhKyBL4i5TVSVBmyhJrhYE6DckaLxHqxyLuVz"
        },
        "3j6c-mds-isyk-22": {
            "prev": "3j6c-mds-in52-22",
            "patches": [ [ "put", [ "e", "ea" ], "each" ] ],
            "key":
                "did:key:zDnaeycJUNQugcrag1WmLePtK9agLYLyXvscnQM4FHm1ASiRV",
            "sig":
                "zSCp2FTsPH51kdZBoHi1TA9idLMwUcv6mhEm78yj16JaQEoMHR2cUVFouYNQP6229Azd4AnNFMmQfFWULKTQBNTu"
        },
        "3j6c-mds-j5qc-22": {
            "prev": "3j6c-mds-in52-22",
            "patches": [ [ "put", [ "Don't", "put", "me" ] "in" ] ],
            "key":
                "did:key:zDnaeycJUNQugcrag1WmLePtK9agLYLyXvscnQM4FHm1ASiRV",
            "sig":
                "z3mTFMVtP4qvkJrtgAZnu3zCSy2mepwpsTf8Pdw29q58kf2pAUcaERBvQVofzS6dWtFaUDiNociYk3oNBzwBfAZQn"
        }
    },
    "key": "did:key:zDnaeeL44gSLMViH9khhTbngNd9r72MhUPo4WKPeSfB8xiDTh",
    "sig": "z5U9LcRntF6jdCBBe7zAjay6XudHAVNJXGuQwo8J5Tts87hyMAvadfAwUC5uoMzyQgZF8psNadwz4GS5Haev9jCN4"
}
```
If a did is not found the consortium can still respond with a signed tick that assets that as of some consensus timestamp the DID did not exist 

## Consensus algorithms

> Note:
> We do not plan to launch with a consensus algorithm.
> At launch but will be mocking the consortium with a single server. 


We need the consensus algorithm for the consortium to provide two properties.
1. Unique monotonically increasing tids.
   * Next timestamp >= last timestamp +1
2. Tids that move forward by the window in a predictable amount of time.
   * now_UTC.microseconds()

`next_timestamp = max(microseconds since 1970, last_timestamp + 1)`

Our TIDs are microseconds since 1970 UTC1. Our recovery keys can be used for 72 hours past when they are revoked. This means that after a revocation we can't rely on the revocation until we receive a tid that is higher then the end of the window. 

To achieve strict ordering of the diffs in an identity tick we must have a consensus group to do the ordering. 
* **single:** The simplest way to do this is a single centralized server that accepts the diffs in a linear order. We use the compare and swap instructions to get atomic incrementing of the timestamp. 
Any ACID local database could provide this single node store.

* **high avalibility:** If we wanted a more robust solution we would move to a leader election protocol like a Paxos or a Raft.
This would allow the single leader to be replaced if it failed. 

* **decentralize:** To decentralize control of the consortium we will need to move to a byzantine fault tolerant consensus algorithm like Narwhal/Tusk to allow mutually distrusting parties to run the nodes in the consortium. Splitting the nodes up amongst consortium members. Potentially split across companies, governments, and individuals.
  
  The last option would be to move to a public ledger like ethereum or bitcoin. We will probably not go this far as public chains tend to be much higher latency than the small invitational consortiums.
  
  A small but globally distributed consensus group can still drop a block ~7 times a second where bitcoin drops a block about every 10 minutes. Also there are many other DID methods that do anchor in a public blockchain and the user could simply use one of them.

## Membership responsibilities 
Each member of the consortium is responsible for: 
1. Storing a complete copy of the current state of the PLC repository.
2. Answering queries for the latest state of a DID’s diff set. (id_tick)
3. Signing the answers with the highest tid to ever come out of the consensus algorithm
   * The TID in the identity tick is the latest tid for the consensus algorithm reaching finality. It not the latest tid from the diff set. If a did doc has not been updated for years the returned tick should still have a near current time for a tid.
4. Members should validate signatures before distributing the update.
5. Members should impose rate limits and size limits distributing the update.
6. Members may monitor other members for regressing timestamps and divergent responses.

## Keys
* adx/consortium_key
  * The consortium_key signs the identity ticks. 
  * This is specified in the spec or the did string.
* adx/tick_key
  * The tick_key signs the ADX repo ticks and is ignored by the consortium.
  * This is specified in the DID document.
* adx/account_key
  * The account_key signs the ADX repo commits and the DID Doc Diffs.
  * This is specified in the DID document.
* adx/recovery_key
  * The recovery_key is used to add or remove account_keys and should only be used to sign diffs for the keys “adx/account_key” and “adx/recovery_key”. It can be used to recover from a stolen key for 72 hours past its revocation time.
  * This is specified in the DID document.

## pid
To encode a number as a Pid we take the bits and encode them as s32. Compress the leading `2`s by replacing them with s32encode(32-n) where n is the number of ‘2’s. By replacing the number of leading ‘2’s with this power scale we can power scale the ID.
pIDs come in two flavors pID120 and pID80.

```python
In [1]: hash = s32(Sha256(origin_diff))
Out[1]: 2222bazpoyabpjpebvnxrrpq7bv6lls5pubxmpvgoxmr4gwmka72

In [2]: compressed = compress(hash)
Out[2]: vbazpoyabpjpebvnxrrpq7bv6lls5pubxmpvgoxmr4gwmka72

In [3]: pid120 = compressed[0:24]
Out[3]: vbazpoyabpjpebvnxrrpq7bv 

In [4]: pid80 = compressed[0:16]
Out[4]: vbazpoyabpjpebvn
```

### pid120
`vbazpoyabpjpebvnxrrpq7bv` 24 s32 characters

The **pid120** is intended to be used when the pid is less likely to need to be typed. The fact that it has 120 bits of entropy means that there is no need to deliberately seed the origin_diff with a nonce to power scale the id. As the expected collision rate is approximately 2^-60

### pid80
`vbazpoyabpjpebvn` 16 s32 characters

The **pid80** is a much smaller id and is much shorter to type. 
The cost of using a pid80 is that the likelihood of a collision is up to 2^-40 so we want to try many nonces in the origin_diff so that the hash has many leading zeros.
This will make it difficult for an attacker to create a collision with the pid.

As hash power grows this work factor can be raised to a point where it is expensive for the attacker to perform 2^75 times as many hashes as the identity creator.


## Sort order invariant base 32 (s32)

```
0                             31
234567abcdefghijklmnopqrstuvwxyz
```

Valid lengths % 8 for a s32 string are 0, 2, 4, 5, 7 lengths 1, 3, 6 are not valid s32

| Chars % 8| Bytes % 5|                           |
|----------|----------|---------------------------|
|        0 |        0 | `[2-7a-z]{8}* `           |
|        2 |        1 | `[2-7a-z]{8}*[2-7a-z]{2}` |
|        4 |        2 | `[2-7a-z]{8}*[2-7a-z]{4}` |
|        5 |        3 | `[2-7a-z]{8}*[2-7a-z]{5}` |
|        7 |        4 | `[2-7a-z]{8}*[2-7a-z]{7}` |
