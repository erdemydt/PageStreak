import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { DataTopic, subscribeToDataChanges } from "../utils/dataEvents";

/**
 * Runs `load` whenever the screen gains focus, again whenever one of `topics`
 * changes while it is focused, and whenever a value in `deps` changes (e.g. a
 * filter or the visible week). `load` may change identity between renders;
 * the latest one is always used.
 */
export function useFocusRefresh(
  load: () => unknown,
  topics: DataTopic[],
  deps: readonly unknown[] = [],
) {
  const loadRef = useRef(load);
  loadRef.current = load;
  const topicsKey = topics.join(",");

  useFocusEffect(
    useCallback(() => {
      loadRef.current();
      return subscribeToDataChanges(topicsKey.split(",") as DataTopic[], () =>
        loadRef.current(),
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [topicsKey, ...deps]),
  );
}
