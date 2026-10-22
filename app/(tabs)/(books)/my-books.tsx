import { Redirect } from "expo-router";

// Merged into the Library (Phase 8.3). Kept so old links still land somewhere;
// remove after a couple of releases.
export default function MyBooksRedirect() {
  return <Redirect href="/(tabs)/(books)" />;
}
