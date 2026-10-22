import { Redirect } from "expo-router";

// Growth Journey moved into the Progress tab (Phase 8.4). Kept so old links
// land somewhere; remove after a couple of releases.
export default function ReadingGrowthRedirect() {
  return <Redirect href="/(tabs)/(progress)/growth" />;
}
