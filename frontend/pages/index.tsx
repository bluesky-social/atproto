import styles from "@components/App.module.scss";

import * as React from "react";

import { service, UserStore, MemoryDB, LocalUser, Post } from '@bluesky-demo/common'
import * as ucan from 'ucans'

import App from "@components/App"
import Register from "@components/Register"

function Home(props: {}) {
  const [localUser, setLocalUser] = React.useState<LocalUser | null>(null);
  const [store, setStore] = React.useState<UserStore | null>(null);
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [tweet, setTweet] = React.useState<string>('');
  const [loading, setLoading] = React.useState<boolean>(true);
  const [users, setAllUsers] = React.useState<string[]>([]);
  const [showUsers, setShowUsers] = React.useState<boolean>(false);

  const addPost = async (post: Post) => {
    await store.addPost(post)
    const car = await store.getCarFile()
    const blueskyDid = await service.getServerDid()
    const token = await ucan.build({
      audience: blueskyDid,
      issuer: localUser.keypair,
      capabilities: [{
        'bluesky': localUser.username,
        'cap': 'POST'
      }]
    })
    await service.updateUser(car, ucan.encode(token))
    setPosts(store.posts)
  }

  const loadPosts = async () => {
    if(localUser === null) return
    let userStore: UserStore
    try {
      const car = await service.fetchUser(localUser.keypair.did())
      userStore = await UserStore.fromCarFile(car, MemoryDB.getGlobal(), localUser.keypair)
    } catch (_err) {
      // @TODO: show error instead of an empty store
      userStore = await createNewStore()
    }
    setStore(userStore)
    setPosts(userStore.posts)
  }

  const createNewStore = async (): Promise<UserStore> => {
    const userStore = await UserStore.create(localUser.username, localUser.keypair)

    if(userStore.posts.length === 0) {
      const testPost = {
        user: localUser.username,
        text: 'hello world!'
      }
      await userStore.addPost(testPost)
    }

    return userStore
  }

  const thirdPartyPost = async () => {
    const audience = await service.getThirdPartyDid()
    const token = await ucan.build({
      audience,
      issuer: localUser.keypair,
      capabilities: [{
        'bluesky': localUser.username,
        'cap': 'POST'
      }]
    })
    await service.thirdPartyPost(localUser.username, ucan.encode(token))
    loadPosts()
  }

  const updateTweet = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTweet(e.target.value)
  }

  const loadLocalUser = async () => {
    const username =  localStorage.getItem('username')
    const secretKey = localStorage.getItem('secretKey')
    if(!username || !secretKey) {
      setLoading(false)
      return
    }

    const keypair = ucan.EdKeypair.fromSecretKey(secretKey, { format: 'base64pad' })
    const registeredDid = await service.fetchUserDid(username)

    // check if server has been reset & frontend cache is out of date
    if(!registeredDid || keypair.did() !== registeredDid) {
      localStorage.clear()
      setLoading(false)
      return
    }

    setLoading(false)
    setLocalUser({ username, keypair })
  }

  // Going to display all users on a server to follow
  const loadAllUsers = async () => {
    let users = await service.fetchUsers()
    setAllUsers(users)
  }

  const postTweet = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    addPost({
      user: localUser.username,
      text: tweet
    });
  }

  const toggleUsers = e => {
    e.preventDefault()
    setShowUsers(!showUsers)
  }

  React.useEffect(() => {
    loadLocalUser()
  }, [])

  React.useEffect(() => {
    loadPosts()
    loadAllUsers()
  }, [localUser]);

  if (loading) {
    return null
  }

  if (localUser === null) {
    return (
      <App>
        <Register onRegister={setLocalUser} />
      </App>
    )
  }

  let userDiv;
  if (showUsers) {
    userDiv = (
      <div className={styles.userBox}>
        <ul>{users.map((user, i) => {
          return(
            <div key={i}>
              <p>{user}</p>
            </div>
          )
        })}</ul>
      </div>
    )
  } else {
    userDiv = <div className={styles.userBox}></div>
  }

  return (
    <App>
      <div className={styles.layoutContainer}>
        <div className={styles.main}>
          <div className={styles.header}>
            <p className={styles.paragraph}>Logged in as <strong>{localUser.username}</strong></p>
            <p className={styles.paragraph}>Putting posts in IPLD.</p>
            <form onSubmit={postTweet}>
              <textarea onChange={updateTweet} className={styles.tweetBox}/>
              <br/>
              <button className={styles.button} type='submit'>Post</button>
            </form>
            <br/><br/>
            <hr/>
            <p className={styles.paragraph}>Or delegate permission to another server to post for you.</p>
            <button className={styles.button} onClick={thirdPartyPost}>Third Party Post</button>
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
        <div className={styles.aside}>
          <div className={styles.divider}>
            <button className={styles.button} onClick={toggleUsers}>Show all users</button>
            <br/>
            {userDiv}
          </div>
        </div>
      </div>
  </App>
  );
}

export default Home;
