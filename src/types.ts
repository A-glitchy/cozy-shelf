export type Presence = "present" | "absent" | "unknown";
export type Verification = "verified" | "unverified-research" | "community-report" | "disputed";
export interface Evidence { label: string; url?: string }
export interface Warning {
  category: string; subcategory?: string; presence: Presence; verification: Verification;
  evidence?: Evidence[]; intensity?: "mild" | "moderate" | "heavy"; note?: string; spoilerNote?: string;
}
export interface Book {
  id: string; title: string; authors: string[]; summary: string;
  pages: { estimate: number | null; confidence: string; source: string };
  genres: string[]; subgenres: string[]; moods: string[];
  warnings: Warning[]; warningsReviewed: "none" | "partial" | "complete";
  sources: Evidence[]; cover: { file: string; attribution: string; license: string } | null;
  research: { status: string; lastReviewed: string };
}
export interface Mood { id: string; label: string; bg: string; text: string }
