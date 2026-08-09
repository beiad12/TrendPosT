export interface RssSource {
  id: string;
  name: string;
  url: string;
  language: "ar" | "fr" | "darija";
}

/**
 * Direct-RSS feeds for known Moroccan outlets. These are a *secondary*
 * signal now (Google News + GDELT are primary) — publisher sites
 * occasionally restructure and break their feeds without notice, so each
 * one is tracked and backed off independently by sourceHealth.ts rather
 * than trusted as the backbone of the system. A feed returning 404/403
 * just quietly stops contributing; it never blocks or crashes the rest of
 * the pipeline.
 */
export const RSS_SOURCES: RssSource[] = [
  { id: "hespress-fr", name: "Hespress (FR)", url: "https://fr.hespress.com/feed", language: "fr" },
  { id: "hespress-ar", name: "Hespress (AR)", url: "https://www.hespress.com/feed", language: "ar" },
  { id: "le360-fr", name: "Le360 (FR)", url: "https://fr.le360.ma/rss", language: "fr" },
  { id: "h24info", name: "H24Info", url: "https://www.h24info.ma/feed/", language: "fr" },
  { id: "akhbarona", name: "Akhbarona", url: "https://www.akhbarona.com/rss/1.xml", language: "ar" },
  { id: "morocco-world-news", name: "Morocco World News", url: "https://www.moroccoworldnews.com/feed", language: "fr" },
  { id: "telquel", name: "TelQuel", url: "https://telquel.ma/feed", language: "fr" },
  { id: "medias24", name: "Médias24", url: "https://medias24.com/feed/", language: "fr" },
];
