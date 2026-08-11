import {
  Redirect,
  type Href,
} from "expo-router";

export default function ChildIndexScreen() {
  return (
    <Redirect
      href={"/(child)/child-home" as Href}
    />
  );
}