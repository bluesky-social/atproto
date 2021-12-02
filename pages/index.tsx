import styles from "@components/App.module.scss";

import * as React from "react";

import App from "@components/App"
import UserStore from "@root/common/user-store";
import { Post } from "@root/common/types";

function Home(props: {}) {
  const [store, setStore] = React.useState<UserStore | null>(null);
  const [posts, setPosts] = React.useState<Post[]>([]);

  const addPost = async (post: Post) => {
    await store.addPost(post)
    setPosts([...posts, post])
  }

  const setupPostsMap = async () => {
    const userStore = await UserStore.create('why')

    if(userStore.posts.length === 0) {
      const testPost = {
        user: 'why',
        text: 'hello world!'
      }
      await userStore.addPost(testPost)
    } 

    setStore(userStore)
    setPosts(userStore.posts)
  }

  React.useEffect(() => {
    setupPostsMap();
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
      </div>
  </App>
  );
}

export default Home;
