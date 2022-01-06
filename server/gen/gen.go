package main

import (
	"fmt"
	"os"

	gen "github.com/whyrusleeping/cbor-gen"

	"github.com/whyrusleeping/bluesky/types"
)

func main() {
	err := gen.WriteMapEncodersToFile("./types/cbor_gen_map.go", "types",
		types.SignedRoot{},
		types.User{},
		types.Post{},
	)
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
