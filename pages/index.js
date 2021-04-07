import styles from "~/components/App.module.scss";

import * as React from "react";

import App from "~/components/App";

function Home(props) {
  // NOTE(jim): just like componentDidMount, but since the second argument is an empty array
  // it won't fire again.
  React.useEffect(() => {
    async function fetchData() {
      const response = await fetch("/api");
      const json = await response.json();
      console.log(json);
    }

    fetchData();
  }, []);

  return (
    <App>
      <div className={styles.center}>
        <p className={styles.paragraph}>From here, you can start any project you like.</p>
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
