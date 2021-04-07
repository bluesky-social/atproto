import styles from "~/components/App.module.scss";
import pkg from "~/package.json";

import * as React from "react";

export default function App(props) {
  return <React.Fragment>{props.children}</React.Fragment>;
}
