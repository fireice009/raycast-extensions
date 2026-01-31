import { ReactNode } from "react";
import { Image } from "@raycast/api";
import { getFavicon } from "@raycast/utils";

export interface Preferences {
  readonly useOriginalFavicon: boolean;
  readonly sortTabsByLatestActiveTime: boolean;
  readonly openTabInProfile: SettingsProfileOpenBehaviour;
  readonly profilePath: string;
}

export enum SettingsProfileOpenBehaviour {
  Default = "default",
  ProfileCurrent = "profile_current",
  ProfileOriginal = "profile_original",
}

export interface SearchResult<T> {
  readonly isLoading: boolean;
  readonly errorView?: ReactNode;
  readonly data?: T[];
  readonly revalidate?: (profileId: string) => void;
}

export interface HistoryEntry {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly lastVisited: Date;
}

export type GroupedEntries = Map<string, HistoryEntry[]>;

export class Tab {
  static readonly TAB_CONTENTS_SEPARATOR: string = "~~~";

  constructor(
    public readonly title: string,
    public readonly url: string,
    public readonly favicon: string,
    public readonly windowsId: number,
    public readonly tabIndex: number,
    public readonly sourceLine: string,
    public readonly windowIndex: number = 0,
    public readonly isActive: boolean = false,
  ) {}

  static parse(line: string): Tab {
    const parts = line.split(this.TAB_CONTENTS_SEPARATOR);

    const windowIndex = parts[5] ? Number(parts[5]) : 0;
    const isActive = parts[6] === "true";

    return new Tab(
      parts[0],
      parts[1],
      parts[2],
      Number(parts[3]),
      Number(parts[4]),
      line,
      Number.isFinite(windowIndex) ? windowIndex : 0,
      isActive,
    );
  }

  key(): string {
    return `${this.windowsId}${Tab.TAB_CONTENTS_SEPARATOR}${this.tabIndex}`;
  }

  urlWithoutScheme(): string {
    try {
      return this.url.replace(/(^\w+:|^)\/\//, "").replace("www.", "");
    } catch {
      // Fallback for any unexpected errors
      return this.url;
    }
  }

  realFavicon(): string {
    try {
      return new URL(this.favicon || "/favicon.ico", this.url).href;
    } catch {
      // Fallback for invalid URLs (e.g., javascript:, data:, etc.)
      return this.favicon || "";
    }
  }

  googleFavicon(): Image.ImageLike {
    try {
      return getFavicon(this.url);
    } catch {
      // Fallback for invalid URLs
      return { source: "" };
    }
  }
}

type BookmarkNodeType = "folder" | "url";

export interface BookmarkDirectory {
  date_added: string;
  children: BookmarkDirectory[];
  type: BookmarkNodeType;
  id: string;
  guid: string;
  source?: string;
  url?: string;
  name: string;
  [key: string]: unknown;
}

export interface RawBookmarkRoot {
  [key: string]: BookmarkDirectory;
}

export interface RawBookmarks {
  roots: RawBookmarkRoot;
  [key: string]: unknown;
}

export interface ExecError extends Error {
  code: number;
  stdout: string;
  stderr: string;
}

export interface ChromeProfile {
  readonly name: string;
  readonly id: string;
}
