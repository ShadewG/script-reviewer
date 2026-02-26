export interface ExtractedPerson {
  name: string;
  role: string;
  actions: string[];
  pageRefs: number[];
}

export interface ExtractedEvent {
  description: string;
  date?: string | null;
  time?: string | null;
  page?: number | null;
}

export interface ExtractedEvidence {
  type: string;
  description: string;
  page?: number | null;
}

export interface ExtractedQuote {
  text: string;
  speaker: string;
  page?: number | null;
}

export interface VerifiableFact {
  claim: string;
  source: string;
  confidence: "confirmed" | "likely" | "uncertain";
}

export interface DocumentFacts {
  fileName: string;
  docType: string;
  summary: string;
  people: ExtractedPerson[];
  events: ExtractedEvent[];
  evidence: ExtractedEvidence[];
  quotes: ExtractedQuote[];
  verifiableFacts: VerifiableFact[];
  rawTextPreview?: string | null;
}
