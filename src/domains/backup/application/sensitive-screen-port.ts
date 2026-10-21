/** Capture/recents protection lease; an acquired key must be released after secret disposal. */
export type SensitiveScreenPort = {
  readonly acquire: () => Promise<string>;
  readonly release: (key: string) => Promise<void>;
};
