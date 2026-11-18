export type Presence = "present" | "absent" | "unknown";
export type Verification = "verified" | "unverified-research" | "community-report" | "disputed";
export interface Evidence { label: string; url?: string; note?: string }
export interface Warning {
  category: string; subcategory?: string; name?: string; presence: Presence; verification: Verification;
  evidence?: Evidence[]; intensity?: "mild" | "minor" | "moderate" | "heavy" | "graphic"; note?: string; spoilerNote?: string;
  /** From the master workbook: the specific kind of abuse (only set on Abuse warnings), where it is shown, and its row id. */
  abuseSubtype?: string; depiction?: "on-page" | "off-page" | "referenced"; warningId?: string;
}
export interface Book {
  id: string; title: string; authors: string[]; summary: string | null;
  pages: { estimate: number | null; confidence: string; source: string };
  genres: string[]; subgenres: string[]; moods: string[];
  warnings: Warning[]; warningsReviewed: "none" | "partial" | "complete";
  sources: Evidence[]; cover: { file: string; attribution: string; license: string } | null;
  research: { status: string; lastReviewed: string };
  custom?: boolean;
  /** Sexual-violence research status from the master workbook. Only a reported trigger is ever shown. */
  svStatus?: "yes" | "no" | "unsure" | "not-recorded"; svNote?: string;
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
export interface Library { version: 1; sessions: Session[]; customBooks: CustomBook[]; goals: Goal[]; excluded: string[]; tombstones: string[]; shelves: Record<string, string[]>; removedWarnings: string[]; settingsUpdatedAt?: string }
