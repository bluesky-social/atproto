import styles from "@components/App.module.scss";

import * as React from "react";

import axios from 'axios'
import * as ucan from 'ucans'

import App from "@components/App"
import UserStore from "@root/common/user-store";
import { Post } from "@root/common/types";

function Home(props: {}) {
  const [store, setStore] = React.useState<UserStore | null>(null);
  const [posts, setPosts] = React.useState<Post[]>([]);

  const addPost = async (post: Post) => {
    await store.addPost(post)
    setPosts([...posts, post])
    const car = await store.getCarFile()
    await axios.post('http://localhost:2583/update', car, { headers: { 'Content-Type': 'application/octet-stream' }})
  }

  const loadPosts = async () => {
    let userStore: UserStore
    try {
      const res = await axios.get('http://localhost:2583/user/why', { responseType: 'arraybuffer' })
      const car = new Uint8Array(res.data)
      userStore = await UserStore.fromCarFile(car)
    } catch (_err) {
      userStore = await createNewStore()
    }
    setStore(userStore)
    setPosts(userStore.posts)
  }

  const createNewStore = async (): Promise<UserStore> => {
    const userStore = await UserStore.create('why')

    if(userStore.posts.length === 0) {
      const testPost = {
        user: 'why',
        text: 'hello world!'
      }
      await userStore.addPost(testPost)
    } 

    return userStore
  }

  const register = async () => {
    const username = 'dholms'
    const audience = 'did:key:z6Mkmi4eUvWtRAP6PNB7MnGfUFdLkGe255ftW9sGo28uv44g'
    const keypair = await ucan.EdKeypair.create()
    const token = await ucan.build({
      audience,
      issuer: keypair
    })
    const encoded = ucan.encode(token)
    await axios.post('http://localhost:2583/register', username, { headers: { "authorization": `Bearer ${encoded}` }})
  }

  React.useEffect(() => {
    loadPosts();
  }, []);

  const handleAddPostButton = () => {
    let elem = document.getElementById("tweetbox") as HTMLTextAreaElement
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
          <ul>
            {posts.map((post, i) => {
              return (
                <div className={styles.post} key={i}>
                  <p className={styles.postUser}>{post.user}</p>
                  <p> {post.text} </p>
                </div>
              ) ;
            })}
          </ul>
        </div>
        <button onClick={register}>Register</button>
      </div>
  </App>
  );
}

export default Home;
