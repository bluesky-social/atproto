package types

import (
	"github.com/ipfs/go-cid"
)

type SignedRoot struct {
	User      cid.Cid `cborgen:"user"`
	Signature []byte  `cborgen:"sig"`
}

type User struct {
	DID       string  `cborgen:"did"`
	Name      string  `cborgen:"name"`
	PostsRoot cid.Cid `cborgen:"postsRoot"`
	NextPost  int64   `cborgen:"nextPost"`

	// TODO: a flat array is the wrong datatype, need some 'list' ADL
	Follows []string `cborgen:"follows"`
}

type Post struct {
	Timestamp string `cborgen:"timestamp"`
	Body      string `cborgen:"body"`
}
