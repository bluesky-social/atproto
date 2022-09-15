# Specs

Bluesky has authored five specs which comprise the v1 of its social networking protocol. These specs are:

- [NameSpaced IDs (NSIDs)](./nsid.md)
- [DID:Placeholder (did:pch)](./did-pch.md)
- [Federated RPC (FedRPC)](./fedrpc.md)
- [Authenticated Data Experiment (ADX)](./adx/)
- Social application (TODO)

These specs can be organize into three layers of dependency:

```
┌─────────────────────────────────────────┐
│ Application                             │
│ ┌────────────────┐ ┌──────────────────┐ │
│ │ FedRPC Methods │ │ ADX Record Types │ │
│ └────────────────┘ └──────────────────┘ │
└─┰──────────┰────────────────────────────┘
  ┃          ┃
  ┃  ┌───────▽────────────────────────────────────────────────────┐
  ┃  │ ADX                                                        │ 
  ┃  │ ┌────────────────┐ ┌──────────────────────┐ ┌────────────┐ │
  ┃  │ │ FedRPC Methods │ │ Repository Structure │ │ adx:// URI │ │
  ┃  │ └────────────────┘ └──────────────────────┘ └────────────┘ │
  ┃  └───────┰────────────────────────────────────────────────────┘
  ┃          ┃
  ▽          ▽
 ┌────────┐ ┌───────┐ ┌─────────────────┐
 │ FedRPC │ │ NSIDs │ │ DID:Placeholder │
 └────────┘ └───────┘ └─────────────────┘
```

[FedRPC](./fedrpc.md) is the "bottom-most" layer, acting as an HTTP-based wire protocol for ADX and its applications. Two identifier formats, [NSID](./nsid.md) and [did:pch](./did-pch.md), were also required to reference semantic information and repositories respectively.

[ADX](./adx/) is a protocol built on top of FedRPC. It is designed to exchanged repositories of user data (structured and binary) which can easily be relocated between services in the federated network. It can be thought of as a form of distributed "block" and "record" storage, but it also anchors the concept of users in the social network.

[TODO Social Application](TODO) is then a collection of FedRPC methods and ADX record types which build atop these protocols. While FedRPC and ADX are intended to be generic infrastructure, TODO is a use-case specific application.