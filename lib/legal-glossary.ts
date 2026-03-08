export interface GlossaryEntry {
  term: string;
  definition: string;
}

export const LEGAL_GLOSSARY: GlossaryEntry[] = [
  { term: "defamation", definition: "A false statement of fact published to a third party that causes reputational harm. Includes both libel (written) and slander (spoken)." },
  { term: "actual malice", definition: "The standard for public figures: knowledge that a statement was false, or reckless disregard for its truth or falsity. (New York Times v. Sullivan)" },
  { term: "anti-SLAPP", definition: "Strategic Lawsuits Against Public Participation. Laws that allow early dismissal of meritless defamation suits targeting free speech, often with fee-shifting." },
  { term: "fair report privilege", definition: "A defense allowing fair and accurate reporting of official proceedings (court records, police reports) without defamation liability." },
  { term: "false light", definition: "A privacy tort where someone is portrayed in a misleading way that would be highly offensive to a reasonable person, even if no specific false fact is stated." },
  { term: "per se", definition: "In defamation, statements so inherently damaging that harm is presumed without proof: accusations of crime, disease, professional incompetence, or sexual misconduct." },
  { term: "statute of limitations", definition: "The time window within which a defamation lawsuit must be filed. Typically 1-3 years from publication, varying by state." },
  { term: "EDSA", definition: "Ethical Documentary Standards Assessment. A checklist evaluating whether a true crime documentary meets ethical standards for victim treatment and factual accuracy." },
  { term: "public figure", definition: "A person who has achieved pervasive fame or voluntarily injected themselves into a public controversy. Must prove actual malice to win defamation claims." },
  { term: "limited purpose public figure", definition: "A person who is a public figure only in relation to a specific controversy or issue, not generally famous." },
  { term: "private figure", definition: "A person who has not sought public attention. Generally only needs to prove negligence (not actual malice) for defamation." },
  { term: "substantial truth", definition: "A defense where the gist of the statement is true even if minor details are inaccurate. The overall impression must not be more damaging than the truth." },
  { term: "negligence", definition: "Failure to exercise reasonable care in verifying the truth of a statement before publishing it. The standard for private figures in most states." },
  { term: "retraction statute", definition: "A state law that limits damages if the publisher issues a timely correction or retraction after being notified of a false statement." },
  { term: "single publication rule", definition: "A statement is considered published once (not each time accessed), starting the statute of limitations. Most states follow this rule." },
  { term: "discovery rule", definition: "The statute of limitations begins when the plaintiff discovers (or should have discovered) the defamatory statement, not when it was published." },
  { term: "opinion privilege", definition: "Pure opinions cannot be defamatory. However, statements of opinion that imply undisclosed facts can be actionable." },
  { term: "neutral reportage", definition: "A privilege allowing journalists to report newsworthy accusations by responsible sources, even if the reporter doubts their truth." },
  { term: "invasion of privacy", definition: "A group of torts including intrusion upon seclusion, public disclosure of private facts, false light, and misappropriation of name/likeness." },
  { term: "public disclosure", definition: "A privacy tort for publishing private facts about someone that would be highly offensive and are not of legitimate public concern." },
  { term: "intrusion upon seclusion", definition: "A privacy tort for intentionally intruding on someone's private affairs in a manner highly offensive to a reasonable person." },
  { term: "community guidelines", definition: "YouTube's content policies governing what may be published. Violations can result in removal, strikes, or channel termination." },
  { term: "age restriction", definition: "YouTube may restrict content to viewers 18+ if it contains mature themes without being severe enough for removal." },
  { term: "monetization", definition: "YouTube's advertiser-friendly guidelines. Content may receive limited or no ads if it features sensitive topics without educational framing." },
  { term: "counsel review", definition: "A flag indicating the legal risk is serious enough that a media attorney should review the content before publication." },
];

const TERM_PATTERN = new RegExp(
  "\\b(" + LEGAL_GLOSSARY.map((g) => g.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")\\b",
  "gi"
);

export function findGlossaryTerms(text: string): Array<{ term: string; index: number; length: number }> {
  const matches: Array<{ term: string; index: number; length: number }> = [];
  let m: RegExpExecArray | null;
  TERM_PATTERN.lastIndex = 0;
  while ((m = TERM_PATTERN.exec(text)) !== null) {
    const entry = LEGAL_GLOSSARY.find(
      (g) => g.term.toLowerCase() === m![0].toLowerCase()
    );
    if (entry) {
      matches.push({ term: entry.term, index: m.index, length: m[0].length });
    }
  }
  return matches;
}

export function getDefinition(term: string): string | undefined {
  return LEGAL_GLOSSARY.find(
    (g) => g.term.toLowerCase() === term.toLowerCase()
  )?.definition;
}
