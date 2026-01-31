import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { getPreferenceValues } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { getFrontmostActiveTabURL, getOpenTabs } from "../actions";
import { NotInstalledError, UnknownError } from "../components";
import { NOT_INSTALLED_MESSAGE } from "../constants";
import { Preferences, SearchResult, Tab } from "../interfaces";
import { matchesQuery, parseSearchQuery } from "../util/search-parser";
import {
  getTabLastActive,
  readTabLastActiveMap,
  TabLastActiveMap,
  touchTabLastActive,
  writeTabLastActiveMap,
} from "../util/tab-last-active";

/**
 * @name useTabSearch
 * Hook to search Chrome tabs using the search parser.
 * See parseSearchQuery() in search-parser.ts for detailed search syntax and examples.
 */
export function useTabSearch(query = ""): SearchResult<Tab> & { data: NonNullable<Tab[]> } {
  const { useOriginalFavicon, sortTabsByLatestActiveTime } = getPreferenceValues<Preferences>();

  const [errorView, setErrorView] = useState<ReactNode | undefined>();

  const [lastActiveVersion, setLastActiveVersion] = useState<number>(0);
  const lastActiveMapRef = useRef<TabLastActiveMap>({});

  const lastSeenActiveUrlRef = useRef<string>("");
  const didSeedActiveRef = useRef<boolean>(false);
  const isUpdatingActiveRef = useRef<boolean>(false);

  const persistDirtyRef = useRef<boolean>(false);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedulePersist = () => {
    persistDirtyRef.current = true;

    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current);
    }

    persistTimeoutRef.current = setTimeout(() => {
      if (!persistDirtyRef.current) return;

      persistDirtyRef.current = false;
      void writeTabLastActiveMap(lastActiveMapRef.current);
    }, 750);
  };

  const { isLoading, data: tabs } = usePromise(
    async (useOriginalFavicon: boolean) => {
      setErrorView(undefined);

      // Keep initial open as fast as the original implementation.
      // (Any last-active bookkeeping is done after render.)
      return await getOpenTabs(useOriginalFavicon);
    },
    [useOriginalFavicon, sortTabsByLatestActiveTime],
    {
      onError(error) {
        if (error.message === NOT_INSTALLED_MESSAGE) {
          setErrorView(<NotInstalledError />);
        } else {
          setErrorView(<UnknownError />);
        }
      },
    },
  );

  // Load persisted last-active map after tabs are shown.
  useEffect(() => {
    if (!sortTabsByLatestActiveTime) {
      return;
    }

    if (isLoading) {
      return;
    }

    let isUnmounted = false;

    const load = async () => {
      const map = await readTabLastActiveMap();
      if (isUnmounted) return;

      lastActiveMapRef.current = map;
      setLastActiveVersion((v) => v + 1);
    };

    void load();

    return () => {
      isUnmounted = true;
    };
  }, [isLoading, sortTabsByLatestActiveTime]);

  // Poll active tab while the list is open to reflect in-Chrome tab switches.
  // Important: do not start polling until the initial tab fetch completed,
  // otherwise we run AppleScript concurrently and the command opens slower.
  useEffect(() => {
    if (!sortTabsByLatestActiveTime) {
      return;
    }

    if (isLoading) {
      return;
    }

    let isUnmounted = false;

    const tick = async () => {
      if (isUnmounted) return;
      if (isUpdatingActiveRef.current) return;

      isUpdatingActiveRef.current = true;
      try {
        const url = await getFrontmostActiveTabURL();
        if (!url) return;

        if (didSeedActiveRef.current && url === lastSeenActiveUrlRef.current) {
          return;
        }

        didSeedActiveRef.current = true;
        lastSeenActiveUrlRef.current = url;

        const changed = touchTabLastActive(lastActiveMapRef.current, url);
        if (changed) {
          schedulePersist();
          setLastActiveVersion((v) => v + 1);
        }
      } finally {
        isUpdatingActiveRef.current = false;
      }
    };

    void tick();
    const interval = setInterval(() => {
      void tick();
    }, 1000);

    return () => {
      isUnmounted = true;
      clearInterval(interval);

      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
        persistTimeoutRef.current = null;
      }

      if (persistDirtyRef.current) {
        persistDirtyRef.current = false;
        void writeTabLastActiveMap(lastActiveMapRef.current);
      }
    };
  }, [isLoading, sortTabsByLatestActiveTime]);

  const data = useMemo(() => {
    const allTabs = tabs || [];

    const parsedQuery = parseSearchQuery(query);
    let results: Tab[];

    if (parsedQuery.includeTerms.length === 0 && parsedQuery.excludeTerms.length === 0) {
      results = allTabs;
    } else {
      results = allTabs.filter((tab) => {
        try {
          const searchable = `${tab.title.toLowerCase()} ${tab.urlWithoutScheme().toLowerCase()}`;
          return matchesQuery(searchable, parsedQuery);
        } catch {
          const searchable = `${tab.title.toLowerCase()} ${tab.url.toLowerCase()}`;
          return matchesQuery(searchable, parsedQuery);
        }
      });
    }

    if (!sortTabsByLatestActiveTime || results.length < 2) {
      return results;
    }

    const decorated = results.map((tab, index) => ({
      tab,
      index,
      lastActive: getTabLastActive(lastActiveMapRef.current, tab.url),
    }));

    decorated.sort((a, b) => b.lastActive - a.lastActive || a.index - b.index);

    return decorated.map((d) => d.tab);
  }, [query, sortTabsByLatestActiveTime, tabs, lastActiveVersion]);

  return { data, isLoading, errorView };
}
