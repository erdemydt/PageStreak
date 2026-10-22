import { Redirect } from "expo-router";

// Profile was retired in Phase 8.4: goals live in Progress, the name in
// Settings. Kept so old links land somewhere; remove after a couple of releases.
export default function ProfileRedirect() {
  return <Redirect href="/(tabs)/(progress)" />;
}
