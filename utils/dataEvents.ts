/**
 * Tiny in-process change bus. Repository writes announce which kind of data
 * changed; mounted screens listening via useFocusRefresh reload. Tabs stay
 * mounted, so this keeps a visible screen current when a modal (e.g. the
 * reading logger) writes underneath it.
 */
export type DataTopic = "books" | "sessions" | "preferences";

type Listener = (topic: DataTopic) => void;

const listeners = new Set<{ topics: DataTopic[]; listener: Listener }>();

// Writes often emit several times in a row (e.g. logSession -> updateBookStatus
// -> sync). Coalesce emits within a short window so each listener reloads once.
const COALESCE_MS = 50;
let pendingTopics = new Set<DataTopic>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  const topics = [...pendingTopics];
  pendingTopics = new Set();
  flushTimer = null;
  for (const entry of [...listeners]) {
    const hit = topics.find((topic) => entry.topics.includes(topic));
    if (hit) entry.listener(hit);
  }
}

export function emitDataChange(...topics: DataTopic[]): void {
  topics.forEach((topic) => pendingTopics.add(topic));
  if (!flushTimer) {
    flushTimer = setTimeout(flush, COALESCE_MS);
  }
}

export function subscribeToDataChanges(
  topics: DataTopic[],
  listener: Listener,
): () => void {
  const entry = { topics, listener };
  listeners.add(entry);
  return () => {
    listeners.delete(entry);
  };
}
