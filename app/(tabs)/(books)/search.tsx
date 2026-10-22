import { Redirect } from "expo-router";

// Search moved into the Add book sheet (Library "+"; Phase 8.3). Kept so old
// links still land somewhere; remove after a couple of releases.
export default function SearchRedirect() {
  return <Redirect href="/(tabs)/(books)" />;
}
