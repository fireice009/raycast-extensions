import { Icon, MenuBarExtra } from "@raycast/api";
import { useEffect, useRef, useState } from "react";
import { getFrontmostActiveTabURL } from "./actions";
import {
  readTabLastActiveMap,
  TabLastActiveMap,
  touchTabLastActive,
  writeTabLastActiveMap,
} from "./util/tab-last-active";

export default function Command() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastUrl, setLastUrl] = useState<string>("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(0);

  const lastActiveMapRef = useRef<TabLastActiveMap>({});
  const isUpdatingRef = useRef<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const map = await readTabLastActiveMap();
        if (!isMounted) return;
        lastActiveMapRef.current = map;
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isUnmounted = false;

    const tick = async () => {
      if (isUnmounted) return;
      if (isUpdatingRef.current) return;

      isUpdatingRef.current = true;
      try {
        const url = await getFrontmostActiveTabURL();
        if (!url) return;

        if (url !== lastUrl) {
          setLastUrl(url);

          const changed = touchTabLastActive(lastActiveMapRef.current, url);
          if (changed) {
            await writeTabLastActiveMap(lastActiveMapRef.current);
            setLastUpdatedAt(Date.now());
          }
        }
      } finally {
        isUpdatingRef.current = false;
      }
    };

    void tick();
    const interval = setInterval(() => {
      void tick();
    }, 60_000);

    return () => {
      isUnmounted = true;
      clearInterval(interval);
    };
  }, [lastUrl]);

  const subtitle = lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : "";

  return (
    <MenuBarExtra icon={Icon.Clock} isLoading={isLoading} title="">
      <MenuBarExtra.Item title="Tracking Chrome active tab" icon={Icon.Binoculars} />
      {lastUrl ? <MenuBarExtra.Item title={lastUrl} icon={Icon.Globe} /> : <MenuBarExtra.Item title="No active tab" />}
      {subtitle ? <MenuBarExtra.Item title={`Last updated: ${subtitle}`} icon={Icon.Clock} /> : null}
    </MenuBarExtra>
  );
}
