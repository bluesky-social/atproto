import styles from "@components/App.module.scss";

import * as React from "react";
import * as Requests from "@common/requests";
import * as Utilities from "@common/utilities";
import * as Block from 'multiformats/block'

import { create, load } from 'ipld-hashmap'
import { sha256 as blockHasher } from 'multiformats/hashes/sha2'
import * as blockCodec from '@ipld/dag-cbor'

import App from "@components/App";


function PostList(props) {

  let [posts, setPosts] = React.useState([]);

  let [curRoot, setRoot] = React.useState("");

  React.useEffect(() => {
    async function loadPosts() {
      let root = props.root;
      let store = props.store;
      let ipld = props.ipld;

      if (!store) {
        console.log("store not yet configured")
        return;
      }

      console.log("store is: ", store)

      console.log("root: ", root, !root);
      if (!root) {
        return;
      }

      const user = await ipld.get(root);

      const map = await load(store, user.postsRoot, { blockHasher, blockCodec });

      console.log("loading posts");
      let entries = await map.entries();
      console.log("the entries", entries[1]);
      let vals = {};
      // TODO: understand how to not have to read every single time...
      for await (const [key, value] of map.entries()) {
        console.log(`[${key}]:`, value);
        vals[key] = value;
      }

      let p = [];
      for (let i = 0; i < user.nextPost; i++) {
        p.push(vals[i])
      }
      setRoot(props.root.toString());
      setPosts(p);
      return;
    }

    console.log("props root: ", props.root)
    if (props.root && props.root.toString() != curRoot) {
      loadPosts();
    }
  });

  console.log(posts);

  return (
    <ul>
      {posts.map((post) => {
        console.log("post is", post);
        return (
          <div className={styles.post}>
            <p className={styles.postUser}>{post.user}</p>
            <p> {post.text} </p>
          </div>
        ) ;
      })}
    </ul>
  );
}

function Home(props) {
  const [db, setDB] = React.useState(null);

  const [root, setRoot] = React.useState(null);


  const [ipldstore, setIpldStore] = React.useState(null);

  React.useEffect(() => {
    async function setupPostsMap() {
      const store = {
        map: new Map(),
        get (k) { return store.map.get(k.toString()) },
        put (k, v) { store.map.set(k.toString(), v) }
      }

      const ipldStore = {
        async get (c) {
          let b = store.get(c)
          console.log("get: ", c, b)
          let block = await Block.create({ bytes: b, cid: c, codec: blockCodec, hasher: blockHasher })
          return block.value
        },
        async put (v) {
          let block = await Block.encode({ value: v, codec: blockCodec, hasher: blockHasher })
          await store.put(block.cid, block.bytes)
          return block.cid
        },
      }
      setIpldStore(ipldStore)

      setDB(store)

      const map = await create(store, { bitWidth: 4, bucketSize: 2, blockHasher, blockCodec })

      var testObj = {
        user: 'why',
        text: 'boop'
      }
      var testObj2 = {
        user: 'why',
        text: 'boopdoop'
      }
      await map.set(0, testObj)
      await map.set(1, testObj2)

      console.log(map.cid)

      let user = {
        name: 'why',
        postsRoot: map.cid,
        nextPost: 2,
      }

      let userRoot = await ipldStore.put(user)
      console.log("userroot: ", userRoot.toString())

      let userOut = await ipldStore.get(userRoot)
      console.log("user out: ", userOut)

      setRoot(userRoot)
    }

    setupPostsMap();
  }, []);


  async function addPost(p) {
    const user = await ipldstore.get(root);

    const posts = await load(db, user.postsRoot, { blockHasher, blockCodec });

    await posts.set(user.nextPost, p);

    user.nextPost++;

    user.postsRoot = posts.cid;

    let userRoot = await ipldstore.put(user);

    setRoot(userRoot);
  }

  function handleAddPostButton() {
    let elem = document.getElementById("tweetbox")
    console.log("addpost", elem.value)
    let post = {
      user: 'anon',
      text: elem.value
    }
    addPost(post);
  }

  return (
    <App>
      <div className={styles.center}>
        <div className={styles.header}>
          <p className={styles.paragraph}>Putting posts in IPFS.</p>
          <textarea id="tweetbox" className={styles.tweetBox}/>
          <br/>
          <button className={styles.button} onClick={handleAddPostButton} >Post</button>
        </div>
        <div className={styles.tweets}>
          {db ? <PostList root={root} store={db} ipld={ipldstore}/> : null}
        </div>
      </div>

</App>
  );
}

export async function getServerSideProps(context) {
  return {
    props: {},
  };
}

export default Home;
