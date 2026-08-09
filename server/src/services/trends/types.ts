export interface NormalizedTrend {
  id: string;
  source: string;
  title: string;
  url: string;
  imageUrl: string | null;
  publishedAt: string | null;
  language: string;
  category: string;
  score: number;
  scoreExplanation: string;
}
