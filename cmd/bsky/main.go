package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"time"

	crand "crypto/rand"

	"github.com/ipfs/go-blockservice"
	"github.com/ipfs/go-cid"
	flatfs "github.com/ipfs/go-ds-flatfs"
	"github.com/ipfs/go-hamt-ipld"
	blockstore "github.com/ipfs/go-ipfs-blockstore"
	cbor "github.com/ipfs/go-ipld-cbor"
	"github.com/ipfs/go-merkledag"
	car "github.com/ipld/go-car"
	_ "github.com/ipld/go-ipld-prime/codec/dagcbor"
	"github.com/libp2p/go-libp2p-core/crypto"
	"github.com/mitchellh/go-homedir"
	"github.com/qri-io/ucan"
	"github.com/urfave/cli/v2"
	"github.com/whyrusleeping/bluesky/types"
	"golang.org/x/xerrors"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func main() {

	app := cli.NewApp()
	app.Flags = []cli.Flag{
		&cli.StringFlag{
			Name:  "repo",
			Value: "~/.bsky",
		},
	}
	app.Commands = []*cli.Command{
		initCmd,
		registerCmd,
		postCmd,
		listCmd,
		pullCmd,
	}

	app.RunAndExitOnError()
}

var initCmd = &cli.Command{
	Name: "init",
	Flags: []cli.Flag{
		&cli.StringFlag{
			Name:  "server",
			Value: "http://localhost:2583",
		},
	},
	Action: func(cctx *cli.Context) error {
		acc, err := initAccount(cctx.Args().First(), cctx.String("server"))
		if err != nil {
			return err
		}

		bskyd, err := homedir.Expand(cctx.String("repo"))
		if err != nil {
			return err
		}

		if err := os.Mkdir(bskyd, 0775); err != nil {
			return err
		}

		r := Repo{Dir: bskyd}
		if err := r.SaveAccount(acc); err != nil {
			return err
		}

		fmt.Println("DID: ", acc.DID)
		return nil
	},
}

var pullCmd = &cli.Command{
	Name: "pull",
	Action: func(cctx *cli.Context) error {
		bskyd, err := homedir.Expand(cctx.String("repo"))
		if err != nil {
			return err
		}

		r, err := openRepo(bskyd)
		if err != nil {
			return err
		}

		ctx := context.TODO()

		id := cctx.Args().First()
		u, err := PullUser(ctx, r, id)
		if err != nil {
			return err
		}

		fmt.Printf("got new data for user %s (%s)\n", id, u.Name)

		return nil
	},
}

func PullUser(ctx context.Context, r *Repo, id string) (*types.User, error) {
	req, err := http.NewRequest("GET", r.Account.Server+"/user/"+id, nil)
	if err != nil {
		return nil, err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}

	cr, err := car.NewCarReader(resp.Body)
	if err != nil {
		return nil, err
	}

	root := cr.Header.Roots[0]

	for {
		blk, err := cr.Next()
		if err != nil {
			if !xerrors.Is(err, io.EOF) {
				return nil, err
			}
			break
		}

		if err := r.Blockstore.Put(ctx, blk); err != nil {
			return nil, err
		}
	}

	cst := cbor.NewCborStore(r.Blockstore)
	var sr types.SignedRoot
	if err := cst.Get(ctx, root, &sr); err != nil {
		return nil, err
	}

	// TODO: verify signature

	var u types.User
	if err := cst.Get(ctx, sr.User, &u); err != nil {
		return nil, err
	}

	if u.DID != id {
		return nil, fmt.Errorf("got back data for wrong user? (%s != %s)", u.DID, id)
	}

	if err := r.DB.Clauses(clause.OnConflict{
		UpdateAll: true,
	}).Create(&UserRecord{
		DID:  u.DID,
		Root: root.String(),
	}).Error; err != nil {
		return nil, err
	}

	return &u, nil
}

var listCmd = &cli.Command{
	Name: "list",
	Action: func(cctx *cli.Context) error {
		bskyd, err := homedir.Expand(cctx.String("repo"))
		if err != nil {
			return err
		}

		r, err := openRepo(bskyd)
		if err != nil {
			return err
		}

		ctx := context.TODO()
		cst := cbor.NewCborStore(r.Blockstore)

		var u types.User
		if err := cst.Get(ctx, r.Account.Root, &u); err != nil {
			return err
		}

		fmt.Printf("%d posts:\n", u.NextPost)

		posts, err := LoadPosts(ctx, cst, u.PostsRoot)
		if err != nil {
			return err
		}

		for i := int64(0); i < u.NextPost; i++ {
			p, err := posts.Get(ctx, i)
			if err != nil {
				return err
			}

			ts, err := time.Parse(time.RFC3339, p.Timestamp)
			if err != nil {
				return fmt.Errorf("invalid timestamp in post %d: %q", i, p.Timestamp)
			}

			fmt.Printf("%s: %s\n", ts.Format(time.Stamp), p.Body)
		}
		return nil
	},
}

type Posts struct {
	hnd *hamt.Node
}

func LoadPosts(ctx context.Context, cst cbor.IpldStore, proot cid.Cid) (*Posts, error) {
	hnd, err := hamt.LoadNode(ctx, cst, proot)
	if err != nil {
		return nil, err
	}

	return &Posts{
		hnd: hnd,
	}, nil
}

func (p *Posts) Get(ctx context.Context, id int64) (*types.Post, error) {
	var pst types.Post
	if err := p.hnd.Find(ctx, fmt.Sprint(id), &pst); err != nil {
		return nil, err
	}

	return &pst, nil
}

var registerCmd = &cli.Command{
	Name: "register",
	Action: func(cctx *cli.Context) error {
		bskyd, err := homedir.Expand(cctx.String("repo"))
		if err != nil {
			return err
		}

		r, err := openRepo(bskyd)
		if err != nil {
			return err
		}

		b, err := json.Marshal(map[string]interface{}{
			"DID": r.Account.DID,
		})
		if err != nil {
			return err
		}

		req, err := http.NewRequest("POST", r.Account.Server+"/register", bytes.NewReader(b))
		if err != nil {
			return err
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()

		u, root, err := readUserCar(context.TODO(), resp.Body, r.Blockstore)
		if err != nil {
			return fmt.Errorf("reading car response: %w", err)
		}

		r.Account.Root = root
		if err := r.SaveAccount(r.Account); err != nil {
			return err
		}

		ub, err := json.Marshal(u)
		if err != nil {
			return err
		}

		fmt.Println("registration complete")
		fmt.Println(string(ub))

		return nil
	},
}

var postCmd = &cli.Command{
	Name: "post",
	Action: func(cctx *cli.Context) error {
		bskyd, err := homedir.Expand(cctx.String("repo"))
		if err != nil {
			return err
		}

		r, err := openRepo(bskyd)
		if err != nil {
			return err
		}

		p := &types.Post{
			Timestamp: time.Now().Format(time.RFC3339),
			Body:      cctx.Args().First(),
		}

		ctx := context.TODO()

		acc := r.Account
		nroot, err := AddPost(ctx, acc.Root, r.Blockstore, p)
		if err != nil {
			return err
		}

		oldroot := acc.Root
		acc.Root = nroot

		if err := r.SaveAccount(acc); err != nil {
			return err
		}

		if err := PushUpdate(ctx, acc, oldroot, r.Blockstore); err != nil {
			return err
		}

		return nil
	},
}

func PushUpdate(ctx context.Context, acc *Account, oldroot cid.Cid, bs blockstore.Blockstore) error {
	sroot := &types.SignedRoot{
		User: acc.Root,
	}
	cst := cbor.NewCborStore(bs)
	rootcid, err := cst.Put(ctx, sroot)
	if err != nil {
		return err
	}

	buf := new(bytes.Buffer)
	dserv := merkledag.NewDAGService(blockservice.New(bs, nil))
	if err := car.WriteCar(ctx, dserv, []cid.Cid{rootcid}, buf); err != nil {
		return err
	}

	req, err := http.NewRequest("POST", acc.Server+"/update", buf)
	if err != nil {
		return err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}

	if resp.StatusCode != 200 {
		return fmt.Errorf("bad status code back from update: %d", resp.StatusCode)
	}

	return nil
}

func AddPost(ctx context.Context, root cid.Cid, bs blockstore.Blockstore, p *types.Post) (cid.Cid, error) {
	cst := cbor.NewCborStore(bs)
	var u types.User
	if err := cst.Get(ctx, root, &u); err != nil {
		return cid.Undef, err
	}

	hnd, err := hamt.LoadNode(ctx, cst, u.PostsRoot)
	if err != nil {
		return cid.Undef, err
	}

	if err := hnd.Set(ctx, fmt.Sprint(u.NextPost), p); err != nil {
		return cid.Undef, err
	}

	if err := hnd.Flush(ctx); err != nil {
		return cid.Undef, err
	}

	npr, err := cst.Put(ctx, hnd)
	if err != nil {
		return cid.Undef, err
	}

	u.NextPost++
	u.PostsRoot = npr

	return cst.Put(ctx, &u)
}

func readUserCar(ctx context.Context, r io.Reader, bs blockstore.Blockstore) (*types.User, cid.Cid, error) {
	cr, err := car.NewCarReader(r)
	if err != nil {
		return nil, cid.Undef, err
	}

	for {
		blk, err := cr.Next()
		if err != nil {
			if xerrors.Is(err, io.EOF) {
				break
			}
			return nil, cid.Undef, err
		}

		if err := bs.Put(ctx, blk); err != nil {
			return nil, cid.Undef, err
		}
	}

	root := cr.Header.Roots[0]
	cst := cbor.NewCborStore(bs)
	var u types.User
	if err := cst.Get(ctx, root, &u); err != nil {
		return nil, cid.Undef, err
	}

	return &u, root, nil
}

func initAccount(name, server string) (*Account, error) {
	priv, pub, err := crypto.GenerateEd25519Key(crand.Reader)
	if err != nil {
		return nil, err
	}

	subjectDID, err := ucan.DIDStringFromPublicKey(pub)
	if err != nil {
		return nil, err
	}

	return &Account{
		Name:   name,
		Server: server,
		Key:    priv,
		DID:    subjectDID,
	}, nil
}

type Account struct {
	Name   string
	Server string

	// TODO: private key management
	Key crypto.PrivKey `json:"-"`
	DID string

	Root cid.Cid
}

func (r *Repo) SaveAccount(acc *Account) error {
	keyb, err := crypto.MarshalPrivateKey(acc.Key)
	if err != nil {
		return err
	}

	if err := ioutil.WriteFile(filepath.Join(r.Dir, "bluesky.key"), keyb, 0600); err != nil {
		return err
	}

	b, err := json.MarshalIndent(acc, "", "  ")
	if err != nil {
		return err
	}

	if err := ioutil.WriteFile(filepath.Join(r.Dir, "account.json"), b, 0660); err != nil {
		return err
	}

	return nil
}

type Repo struct {
	Account    *Account
	Blockstore blockstore.Blockstore
	DB         *gorm.DB
	Dir        string
}

func openRepo(dir string) (*Repo, error) {
	accb, err := ioutil.ReadFile(filepath.Join(dir, "account.json"))
	if err != nil {
		return nil, err
	}

	keyb, err := ioutil.ReadFile(filepath.Join(dir, "bluesky.key"))
	if err != nil {
		return nil, err
	}

	var acc Account
	if err := json.Unmarshal(accb, &acc); err != nil {
		return nil, err
	}

	k, err := crypto.UnmarshalPrivateKey(keyb)
	if err != nil {
		return nil, err
	}

	acc.Key = k

	ds, err := flatfs.CreateOrOpen(filepath.Join(dir, "blocks"), flatfs.IPFS_DEF_SHARD, false)
	if err != nil {
		return nil, err
	}

	bs := blockstore.NewBlockstoreNoPrefix(ds)

	db, err := gorm.Open(sqlite.Open(filepath.Join(dir, "bsky.db")))
	if err != nil {
		return nil, err
	}

	db.AutoMigrate(&UserRecord{})

	return &Repo{
		Account:    &acc,
		Blockstore: bs,
		DB:         db,
		Dir:        dir,
	}, nil

}

type UserRecord struct {
	DID  string `gorm:"unique"`
	Root string
}
