export interface CaseMetadata {
  state: string;
  caseStatus: "convicted" | "charged" | "suspect" | "acquitted" | "unsolved";
  hasMinors: boolean;
  footageTypes: string[];
  videoTitle?: string;
  thumbnailDesc?: string;
}

export interface ParsedEntity {
  name: string;
  role: "suspect" | "victim" | "witness" | "officer" | "attorney" | "family" | "other";
  allegations: string[];
  labels: string[];
}

export interface ProfanityInstance {
  word: string;
  line: number;
  severity: "mild" | "moderate" | "strong";
}

export interface GraphicContent {
  description: string;
  line: number;
  type: "violence" | "blood" | "body" | "injury" | "sexual" | "other";
}

export interface ScriptClaim {
  text: string;
  line: number;
  type: "fact" | "attributed" | "opinion" | "speculation";
  source?: string;
}

export interface ParsedScript {
  entities: ParsedEntity[];
  profanity: ProfanityInstance[];
  graphicContent: GraphicContent[];
  claims: ScriptClaim[];
  locations: string[];
  dates: string[];
  timeline: string[];
}

export interface LegalFlag {
  line?: number;
  text: string;
  person: string;
  riskType: "defamation" | "privacy" | "false_light" | "appropriation";
  severity: "low" | "medium" | "high" | "severe";
  reasoning: string;
  stateCitation?: string;
  saferRewrite: string;
  counselReview: boolean;
  confidence: number;
}

export interface CrossValidatedLegalFlag extends LegalFlag {
  agreementCount: number;
  models: string[];
  originalSeverities: Record<string, string>;
  crossValidated: true;
}

export interface PolicyFlag {
  line?: number;
  text: string;
  category: "community_guidelines" | "age_restriction" | "monetization" | "edsa_context" | "metadata";
  severity: "low" | "medium" | "high" | "severe";
  policyName: string;
  policyQuote?: string;
  impact: "full_ads" | "limited_ads" | "no_ads" | "age_restricted" | "removal_risk";
  saferRewrite?: string;
  reasoning: string;
}

export interface PersonResearch {
  name: string;
  caseStatus?: string;
  isPublicFigure: boolean;
  publicFigureReason?: string;
  isDeceased: boolean;
  criminalRecord?: string;
  newsCoverage: string;
  courtRecords?: string;
}

export interface ResearchFindings {
  caseStatus: string;
  caseJurisdiction?: string;
  caseNumbers?: string[];
  personProfiles: PersonResearch[];
  courtRecords: string[];
  keyCitations: string[];
}

export interface SynthesisReport {
  verdict: "publishable" | "borderline" | "not_publishable";
  riskScore: number;
  summary: string;
  riskDashboard: {
    communityGuidelines: "low" | "medium" | "high";
    ageRestriction: "low" | "medium" | "high";
    monetization: "full_ads" | "limited_ads" | "no_ads";
    privacy: "low" | "medium" | "high";
    legal: "low" | "medium" | "high";
  };
  criticalEdits: Array<{
    line?: number;
    original: string;
    suggested: string;
    reason: string;
  }>;
  recommendedEdits: Array<{
    line?: number;
    original: string;
    suggested: string;
    reason: string;
  }>;
  edsaChecklist: Array<{
    item: string;
    status: "present" | "missing" | "partial";
    note?: string;
  }>;
  legalFlags: LegalFlag[];
  policyFlags: PolicyFlag[];
}

export interface StageUpdate {
  stage: number;
  name: string;
  status: "pending" | "running" | "complete" | "error";
  data?: unknown;
  error?: string;
}
