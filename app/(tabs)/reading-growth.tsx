import { Redirect } from "expo-router";

// Growth Journey moved into the Progress tab (Phase 8.4). Kept so old links
// land somewhere; remove after a couple of releases. Lands on the Progress
// index (one tap from Growth): a direct link to growth would leave the stack
// without its index underneath
export default function ReadingGrowthRedirect() {
  return <Redirect href="/(tabs)/(progress)" />;
}
