package main

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"

	"github.com/filecoin-project/go-hamt-ipld"
	blocks "github.com/ipfs/go-block-format"
	bserv "github.com/ipfs/go-blockservice"
	"github.com/ipfs/go-cid"
	"github.com/ipfs/go-datastore"
	syncds "github.com/ipfs/go-datastore/sync"
	blockstore "github.com/ipfs/go-ipfs-blockstore"
	cbor "github.com/ipfs/go-ipld-cbor"
	"github.com/ipfs/go-merkledag"
	car "github.com/ipld/go-car"
	_ "github.com/ipld/go-ipld-prime/codec/dagcbor"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	ucan "github.com/qri-io/ucan"
	didkey "github.com/qri-io/ucan/didkey"
	"github.com/whyrusleeping/bluesky/types"
	cbg "github.com/whyrusleeping/cbor-gen"
	"golang.org/x/xerrors"
)

var twitterCaps = ucan.NewNestedCapabilities("POST")

const TwitterDid = "did:key:z6Mkmi4eUvWtRAP6PNB7MnGfUFdLkGe255ftW9sGo28uv44g"

type Server struct {
	Blockstore blockstore.Blockstore
	UcanStore  ucan.TokenStore

	ulk       sync.Mutex
	UserRoots map[string]cid.Cid
	UserDids  map[string]*didkey.ID
}

func main() {

	ds := syncds.MutexWrap(datastore.NewMapDatastore())
	bs := blockstore.NewBlockstore(ds)
	s := &Server{
		UserRoots:  make(map[string]cid.Cid),
		UserDids:   make(map[string]*didkey.ID),
		Blockstore: bs,
		UcanStore:  ucan.NewMemTokenStore(),
	}

	e := echo.New()
	e.Use(middleware.Logger())
	e.Use(middleware.CORS())

	e.POST("/register", s.handleRegister)

	e.POST("/update", s.handleUserUpdate)
	e.GET("/user/:id", s.handleGetUser)
	e.GET("/.well-known/did.json", s.handleGetDid)
	e.GET("/.well-known/webfinger", s.handleWebfinger)
	panic(e.Start(":2583"))
}

func (s *Server) ensureGraphWalkability(ctx context.Context, u *types.User, bs blockstore.Blockstore) error {
	if err := s.graphWalkRec(ctx, u.PostsRoot, bs); err != nil {
		return err
	}

	return nil
}

func (s *Server) graphWalkRec(ctx context.Context, c cid.Cid, bs blockstore.Blockstore) error {
	eitherGet := func(cc cid.Cid) (blocks.Block, error) {
		baseHas, err := s.Blockstore.Has(ctx, cc)
		if err != nil {
			return nil, err
		}

		if baseHas {
			// this graph is already in our blockstore
			return nil, nil
		}

		return bs.Get(ctx, cc)
	}

	b, err := eitherGet(c)
	if err != nil {
		return err
	}

	if b == nil {
		return nil
	}

	var links []cid.Cid
	if err := cbg.ScanForLinks(bytes.NewReader(b.RawData()), func(l cid.Cid) {
		links = append(links, l)
	}); err != nil {
		return err
	}

	for _, l := range links {
		if err := s.graphWalkRec(ctx, l, bs); err != nil {
			return err
		}
	}

	return nil
}

// TODO: we probably want this to be a compare-and-swap
func (s *Server) handleUserUpdate(e echo.Context) error {
	ctx := e.Request().Context()

	// check ucan permission
	encoded := getBearer(e.Request())
	p := ucan.NewTokenParser(twitterAC, ucan.StringDIDPubKeyResolver{}, s.UcanStore.(ucan.CIDBytesResolver))
	token, err := p.ParseAndVerify(ctx, encoded)
	if err != nil {
		return err
	}

	if token.Audience.String() != TwitterDid {
		return fmt.Errorf("Ucan not directed to twitter server")
	}

	checkUser := func(u *types.User) error {
		att := ucan.Attenuation{
			Rsc: newAccountResource("twitter", u.Name),
			Cap: twitterCaps.Cap("POST"),
		}

		isGood := token.Attenuations.Contains(ucan.Attenuations{att})

		if !isGood {
			return fmt.Errorf("Ucan attenuation check failed")
		}

		// user not registerd
		if s.UserDids[u.Name] == nil {
			return fmt.Errorf("user not registered")
		}

		// ucan's root issuer does not match user's DID
		rootIss, err := s.rootIssuer(ctx, token)
		if err != nil {
			return err
		}
		if rootIss.String() != s.UserDids[u.Name].String() {
			return fmt.Errorf("root issuer does not match users DID")
		}

		return nil
	}

	carr, err := car.NewCarReader(e.Request().Body)
	if err != nil {
		return err
	}

	return s.updateUser(ctx, carr, checkUser)
}

func (s *Server) updateUser(ctx context.Context, cr *car.CarReader, authCheck func(u *types.User) error) error {
	// The body of the request should be a car file containing any *changed* blocks
	roots := cr.Header.Roots

	if len(roots) != 1 {
		// only allow a single dag to be sent for updates
		return fmt.Errorf("cannot have multiple dag roots")
	}

	ds := syncds.MutexWrap(datastore.NewMapDatastore())
	tmpbs := blockstore.NewBlockstore(ds)

	for {
		blk, err := cr.Next()
		if err != nil {
			if !xerrors.Is(err, io.EOF) {
				return err
			}
			break
		}

		if err := tmpbs.Put(ctx, blk); err != nil {
			return err
		}
	}

	rblk, err := tmpbs.Get(ctx, roots[0])
	if err != nil {
		return fmt.Errorf("getting root: %w", err)
	}

	var sroot types.SignedRoot
	if err := sroot.UnmarshalCBOR(bytes.NewReader(rblk.RawData())); err != nil {
		return err
	}

	// TODO: check signature

	ublk, err := tmpbs.Get(ctx, sroot.User)
	if err != nil {
		return fmt.Errorf("reading user object under signed root: %w", err)
	}

	var user types.User
	if err := user.UnmarshalCBOR(bytes.NewReader(ublk.RawData())); err != nil {
		return err
	}

	if err := s.ensureGraphWalkability(ctx, &user, tmpbs); err != nil {
		return fmt.Errorf("checking graph walkability failed: %w", err)
	}

	if err := authCheck(&user); err != nil {
		return fmt.Errorf("auth check failed: %w", err)
	}

	fmt.Println("user update: ", user.Name, user.NextPost, user.PostsRoot)

	if err := Copy(ctx, tmpbs, s.Blockstore); err != nil {
		return fmt.Errorf("copy from temp blockstore failed: %w", err)
	}

	if err := s.updateUserRoot(user.DID, roots[0]); err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	return nil
}

func (s *Server) updateUserRoot(did string, rcid cid.Cid) error {
	s.ulk.Lock()
	defer s.ulk.Unlock()

	s.UserRoots[did] = rcid
	return nil
}

func (s *Server) getUser(id string) (cid.Cid, error) {
	s.ulk.Lock()
	defer s.ulk.Unlock()

	c, ok := s.UserRoots[id]
	if !ok {
		return cid.Undef, fmt.Errorf("no such user")
	}

	return c, nil
}

func (s *Server) handleGetUser(c echo.Context) error {
	ctx := c.Request().Context()

	ucid, err := s.getUser(c.Param("id"))
	if err != nil {
		return err
	}

	ds := merkledag.NewDAGService(bserv.New(s.Blockstore, nil))
	c.Response().Header().Set(echo.HeaderContentType, echo.MIMEOctetStream)
	return car.WriteCar(ctx, ds, []cid.Cid{ucid}, c.Response().Writer)
}

type registerResponse struct {
	OK bool
}

func (s *Server) handleRegister(e echo.Context) error {
	ctx := e.Request().Context()
	encoded := getBearer(e.Request())

	// TODO: understand why this DID stuff works the way it does
	p := ucan.NewTokenParser(emptyAC, ucan.StringDIDPubKeyResolver{}, s.UcanStore.(ucan.CIDBytesResolver))
	token, err := p.ParseAndVerify(ctx, encoded)
	if err != nil {
		return fmt.Errorf("parsing ucan auth token: %w", err)
	}

	// 'TwitterDid' here is really just the DID of this server instance
	if token.Audience.String() != TwitterDid {
		return fmt.Errorf("Ucan not directed to twitter server")
	}

	limr := io.LimitReader(e.Request().Body, 1<<20)

	carr, err := car.NewCarReader(limr)
	if err != nil {
		return fmt.Errorf("reading register body data: %w", err)
	}

	checkUser := func(u *types.User) error {
		// TODO: this needs a lock
		_, ok := s.UserDids[u.Name]
		if ok {
			return fmt.Errorf("username already registered")
		}
		// TODO: register user info in a real database

		s.UserDids[u.Name] = &token.Issuer

		return nil
	}

	if err := s.updateUser(ctx, carr, checkUser); err != nil {
		return err
	}

	return e.JSON(200, &registerResponse{
		OK: true,
	})
}

func Copy(ctx context.Context, from, to blockstore.Blockstore) error {
	ch, err := from.AllKeysChan(ctx)
	if err != nil {
		return err
	}

	for k := range ch {
		blk, err := from.Get(ctx, k)
		if err != nil {
			return err
		}

		if err := to.Put(ctx, blk); err != nil {
			return err
		}
	}

	return nil
}

type wrappedDid struct {
	Id string `json:"id"`
}

func (s *Server) handleGetDid(e echo.Context) error {
	e.JSON(http.StatusOK, wrappedDid{Id: TwitterDid})
	return nil
}

func (s *Server) handleWebfinger(e echo.Context) error {
	resource := e.QueryParam("resource")
	if resource == "" {
		return fmt.Errorf("No resource provided")
	}

	userDid := s.UserDids[resource]
	if userDid == nil {
		return fmt.Errorf("User not found")
	}

	e.JSON(http.StatusOK, wrappedDid{Id: userDid.String()})
	return nil
}

func getBearer(req *http.Request) string {
	reqToken := req.Header.Get("Authorization")
	splitToken := strings.Split(reqToken, "Bearer ")
	// TODO: check that we didnt get a malformed authorization header, otherwise the next line will panic
	return splitToken[1]
}

func twitterAC(m map[string]interface{}) (ucan.Attenuation, error) {
	var (
		cap string
		rsc ucan.Resource
	)
	for key, vali := range m {
		val, ok := vali.(string)
		if !ok {
			return ucan.Attenuation{}, fmt.Errorf(`expected attenuation value to be a string`)
		}

		if key == ucan.CapKey {
			cap = val
		} else {
			rsc = newAccountResource(key, val)
		}
	}

	return ucan.Attenuation{
		Rsc: rsc,
		Cap: twitterCaps.Cap(cap),
	}, nil
}

func emptyAC(m map[string]interface{}) (ucan.Attenuation, error) {
	return ucan.Attenuation{}, nil
}

type accountRsc struct {
	t string
	v string
}

// NewStringLengthResource is a silly implementation of resource to use while
// I figure out what an OR filter on strings is. Don't use this.
func newAccountResource(typ, val string) ucan.Resource {
	return accountRsc{
		t: typ,
		v: val,
	}
}

func (r accountRsc) Type() string {
	return r.t
}

func (r accountRsc) Value() string {
	return r.v
}

func (r accountRsc) Contains(b ucan.Resource) bool {
	return r.Type() == b.Type() && r.Value() <= b.Value()
}

func (s *Server) getEmptyPostsRoot(ctx context.Context, cst cbor.IpldStore) (cid.Cid, error) {
	n := hamt.NewNode(cst)
	return cst.Put(ctx, n)
}

// naive implementation that does not take into account ucans with multiple proofs
func (s *Server) rootIssuer(ctx context.Context, u *ucan.Token) (didkey.ID, error) {
	if len(u.Proofs) == 0 {
		return u.Issuer, nil
	}
	p := ucan.NewTokenParser(twitterAC, ucan.StringDIDPubKeyResolver{}, s.UcanStore.(ucan.CIDBytesResolver))
	proof, err := p.ParseAndVerify(ctx, string(u.Proofs[0]))
	if err != nil {
		return didkey.ID{}, err
	}
	return s.rootIssuer(ctx, proof)
}
