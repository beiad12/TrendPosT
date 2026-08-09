import { googleNewsProvider } from "./googleNews.js";
import { gdeltProvider } from "./gdelt.js";
import { publisherRssProvider } from "./publisherRss.js";
import { redditProvider } from "./reddit.js";
import { googleTrendsProvider } from "./googleTrends.js";
import type { TrendProvider } from "./types.js";

export type { TrendProvider };

/**
 * Every registered trend source. Adding a new one later means writing a
 * module here and appending it to this array — nothing else in the engine
 * needs to change.
 */
export const ALL_PROVIDERS: TrendProvider[] = [
  googleNewsProvider,
  gdeltProvider,
  publisherRssProvider,
  redditProvider,
  googleTrendsProvider,
];
