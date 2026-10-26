import { Redirect } from "expo-router";

/** Compatibility for saved links to the former Books tab. */
export default function BooksRedirect() {
  return <Redirect href="/groups" />;
}
