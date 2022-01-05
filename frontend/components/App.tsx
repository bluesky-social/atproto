import styles from "@components/App.module.scss";

import * as React from "react";

export default function App(props) {
  return (
    <div className={styles.center}>
      {props.children}
    </div>
  )
}
