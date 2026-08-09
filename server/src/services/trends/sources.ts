export interface RssSource {
  name: string;
  url: string;
  language: "ar" | "fr" | "darija";
}

/**
 * Public RSS feeds for major Moroccan news outlets.
 * Feed URLs are best-effort and may need periodic verification, since
 * outlets occasionally restructure their sites.
 */
export const RSS_SOURCES: RssSource[] = [
  { name: "Hespress (FR)", url: "https://fr.hespress.com/feed", language: "fr" },
  { name: "Hespress (AR)", url: "https://www.hespress.com/feed", language: "ar" },
  { name: "Le360 (FR)", url: "https://fr.le360.ma/rss", language: "fr" },
  { name: "H24Info", url: "https://www.h24info.ma/feed/", language: "fr" },
  { name: "Akhbarona", url: "https://www.akhbarona.com/rss/1.xml", language: "ar" },
];
