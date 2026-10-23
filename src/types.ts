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
  custom?: boolean;
}
export interface Mood { id: string; label: string; bg: string; text: string }

export type Status = "want" | "reading" | "read" | "hold" | "dnf";
export interface Session {
  id: string; bookRef: string; status: Status;
  startDate?: string; finishDate?: string; rating?: number;
  review?: string; notes?: string; favorite: boolean; tags: string[]; updatedAt: string;
}
export interface CustomBook {
  id: string; title: string; authors: string[]; pages: number | null;
  genres: string[]; moods: string[]; summary?: string; createdAt: string;
}
export interface Goal { year: number; target: number }
export interface Library { version: 1; sessions: Session[]; customBooks: CustomBook[]; goals: Goal[] }
