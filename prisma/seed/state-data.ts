interface StateLawSeed {
  state: string;
  abbrev: string;
  defamationDefinition: string;
  defamationStatute: string | null;
  standardOfFault: { publicFigure: string; privateFigure: string };
  perSeCategories: string[];
  perSeStatute: string | null;
  libelSOL: string;
  slanderSOL: string;
  solStatute: string | null;
  discoveryRule: boolean;
  singlePublicationRule: boolean;
  fairReportPrivilege: boolean;
  fairReportScope: string | null;
  fairReportStatute: string | null;
  neutralReportage: boolean;
  neutralReportageNote: string | null;
  opinionPrivilege: string | null;
  truthDefense: string;
  substantialTruth: boolean;
  retractionStatute: boolean;
  retractionDetails: string | null;
  hasAntiSlapp: boolean;
  antiSlappGrade: string | null;
  antiSlappStatute: string | null;
  antiSlappScope: string | null;
  antiSlappBurden: string | null;
  antiSlappFeeShifting: boolean | null;
  antiSlappAppeal: boolean | null;
  publicFigureTest: string | null;
  limitedPurposePF: string | null;
  involuntaryPF: boolean | null;
  privacyTortsRecognized: string[];
  falseLightRecognized: boolean;
  falseLightNote: string | null;
  criminalDefamation: boolean;
  criminalDefStatute: string | null;
  deadPersonDefamation: boolean;
  internetJurisdiction: string | null;
  sources: string[];
  notes: string | null;
}

const COMMON_PER_SE = [
  "crime",
  "loathsome_disease",
  "professional_incompetence_or_misconduct",
  "serious_sexual_misconduct",
];

const ALL_PRIVACY_TORTS = [
  "intrusion_upon_seclusion",
  "public_disclosure_private_facts",
  "false_light",
  "appropriation_of_name_or_likeness",
];

const DEFAULT_SOURCES = [
  "https://www.law.cornell.edu/wex/defamation",
  "https://www.ifs.org/anti-slapp-states/",
  "https://www.rcfp.org/anti-slapp-guide/",
];

const STATE_LIST: Array<{ state: string; abbrev: string }> = [
  { state: "Alabama", abbrev: "AL" },
  { state: "Alaska", abbrev: "AK" },
  { state: "Arizona", abbrev: "AZ" },
  { state: "Arkansas", abbrev: "AR" },
  { state: "California", abbrev: "CA" },
  { state: "Colorado", abbrev: "CO" },
  { state: "Connecticut", abbrev: "CT" },
  { state: "Delaware", abbrev: "DE" },
  { state: "District of Columbia", abbrev: "DC" },
  { state: "Florida", abbrev: "FL" },
  { state: "Georgia", abbrev: "GA" },
  { state: "Hawaii", abbrev: "HI" },
  { state: "Idaho", abbrev: "ID" },
  { state: "Illinois", abbrev: "IL" },
  { state: "Indiana", abbrev: "IN" },
  { state: "Iowa", abbrev: "IA" },
  { state: "Kansas", abbrev: "KS" },
  { state: "Kentucky", abbrev: "KY" },
  { state: "Louisiana", abbrev: "LA" },
  { state: "Maine", abbrev: "ME" },
  { state: "Maryland", abbrev: "MD" },
  { state: "Massachusetts", abbrev: "MA" },
  { state: "Michigan", abbrev: "MI" },
  { state: "Minnesota", abbrev: "MN" },
  { state: "Mississippi", abbrev: "MS" },
  { state: "Missouri", abbrev: "MO" },
  { state: "Montana", abbrev: "MT" },
  { state: "Nebraska", abbrev: "NE" },
  { state: "Nevada", abbrev: "NV" },
  { state: "New Hampshire", abbrev: "NH" },
  { state: "New Jersey", abbrev: "NJ" },
  { state: "New Mexico", abbrev: "NM" },
  { state: "New York", abbrev: "NY" },
  { state: "North Carolina", abbrev: "NC" },
  { state: "North Dakota", abbrev: "ND" },
  { state: "Ohio", abbrev: "OH" },
  { state: "Oklahoma", abbrev: "OK" },
  { state: "Oregon", abbrev: "OR" },
  { state: "Pennsylvania", abbrev: "PA" },
  { state: "Rhode Island", abbrev: "RI" },
  { state: "South Carolina", abbrev: "SC" },
  { state: "South Dakota", abbrev: "SD" },
  { state: "Tennessee", abbrev: "TN" },
  { state: "Texas", abbrev: "TX" },
  { state: "Utah", abbrev: "UT" },
  { state: "Vermont", abbrev: "VT" },
  { state: "Virginia", abbrev: "VA" },
  { state: "Washington", abbrev: "WA" },
  { state: "West Virginia", abbrev: "WV" },
  { state: "Wisconsin", abbrev: "WI" },
  { state: "Wyoming", abbrev: "WY" },
];

const SOL_YEARS: Record<string, string> = {
  AL: "2 years",
  AK: "2 years",
  AZ: "1 year",
  AR: "3 years",
  CA: "1 year",
  CO: "1 year",
  CT: "2 years",
  DE: "2 years",
  DC: "1 year",
  FL: "2 years",
  GA: "1 year",
  HI: "2 years",
  ID: "2 years",
  IL: "1 year",
  IN: "2 years",
  IA: "2 years",
  KS: "1 year",
  KY: "1 year",
  LA: "1 year",
  ME: "2 years",
  MD: "1 year",
  MA: "3 years",
  MI: "1 year",
  MN: "2 years",
  MS: "1 year",
  MO: "2 years",
  MT: "2 years",
  NE: "1 year",
  NV: "2 years",
  NH: "3 years",
  NJ: "1 year",
  NM: "3 years",
  NY: "1 year",
  NC: "1 year",
  ND: "2 years",
  OH: "1 year",
  OK: "1 year",
  OR: "2 years",
  PA: "1 year",
  RI: "3 years",
  SC: "2 years",
  SD: "2 years",
  TN: "1 year",
  TX: "1 year",
  UT: "1 year",
  VT: "3 years",
  VA: "1 year",
  WA: "2 years",
  WV: "1 year",
  WI: "3 years",
  WY: "1 year",
};

const SOL_STATUTES: Record<string, string | null> = {
  AZ: "A.R.S. § 12-541(1)",
  CA: "Cal. Code Civ. Proc. § 340(c)",
  CO: "C.R.S. § 13-80-103(1)(a)",
  DC: "D.C. Code § 12-301(4)",
  FL: "Fla. Stat. § 95.11(4)(h)",
  GA: "O.C.G.A. § 9-3-33",
  IL: "735 ILCS 5/13-201",
  MI: "Mich. Comp. Laws § 600.5805(11)",
  NC: "N.C. Gen. Stat. § 1-54(3)",
  NY: "N.Y. C.P.L.R. 215(3)",
  OH: "Ohio Rev. Code § 2305.11(A)",
  PA: "42 Pa.C.S. § 5523(1)",
  TN: "Tenn. Code Ann. § 28-3-104(a)(1)(A)",
  TX: "Tex. Civ. Prac. & Rem. Code § 16.002(a)",
  VA: "Va. Code § 8.01-247.1",
  WA: "RCW 4.16.100(1)",
};

const NO_FALSE_LIGHT = new Set(["FL", "NC", "NY", "TX", "VA"]);
const CRIMINAL_DEF_STATES = new Set(["GA", "ID", "KS", "LA", "MN", "MS", "NC", "ND", "OK", "UT", "WI"]);

const BASE_RECORD: Omit<StateLawSeed, "state" | "abbrev" | "libelSOL" | "slanderSOL" | "solStatute"> = {
  defamationDefinition:
    "False statement of fact published to a third party, with fault, causing reputational harm; constitutional limits apply for public-concern speech.",
  defamationStatute: null,
  standardOfFault: {
    publicFigure: "actual_malice",
    privateFigure: "negligence",
  },
  perSeCategories: COMMON_PER_SE,
  perSeStatute: null,
  discoveryRule: false,
  singlePublicationRule: true,
  fairReportPrivilege: true,
  fairReportScope: "qualified",
  fairReportStatute: null,
  neutralReportage: false,
  neutralReportageNote: "Varies and is inconsistently recognized by jurisdiction.",
  opinionPrivilege: "milkovich_opinion_rhetorical_hyperbole",
  truthDefense: "complete_defense",
  substantialTruth: true,
  retractionStatute: false,
  retractionDetails: null,
  hasAntiSlapp: false,
  antiSlappGrade: null,
  antiSlappStatute: null,
  antiSlappScope: null,
  antiSlappBurden: null,
  antiSlappFeeShifting: null,
  antiSlappAppeal: null,
  publicFigureTest: "gertz_and_sullivan_framework",
  limitedPurposePF: "recognized",
  involuntaryPF: true,
  privacyTortsRecognized: ALL_PRIVACY_TORTS,
  falseLightRecognized: true,
  falseLightNote: null,
  criminalDefamation: false,
  criminalDefStatute: null,
  deadPersonDefamation: false,
  internetJurisdiction: "single_publication_rule_for_online_publications_common",
  sources: DEFAULT_SOURCES,
  notes: "Baseline record; verify against current state statutes/case law before production use.",
};

const OVERRIDES: Record<string, Partial<StateLawSeed>> = {
  AZ: {
    hasAntiSlapp: true,
    antiSlappGrade: "B",
    antiSlappStatute: "A.R.S. §§ 12-751 to 12-752",
    antiSlappScope: "broader than petitioning after amendments; still less robust than UPEPA states",
    antiSlappBurden: "movant prima facie improper-motive showing, then response required",
    antiSlappFeeShifting: true,
    antiSlappAppeal: true,
    sources: [
      "https://www.azleg.gov/ars/12/00751.htm",
      "https://www.azleg.gov/ars/12/00752.htm",
      "https://www.ifs.org/anti-slapp-states/arizona/",
    ],
    notes: "Priority state: anti-SLAPP and SOL fields set from Arizona code text.",
  },
  CA: {
    defamationStatute: "Cal. Civ. Code §§ 44-46",
    fairReportStatute: "Cal. Civ. Code § 47(d)",
    retractionStatute: true,
    retractionDetails: "Cal. Civ. Code §§ 48a-48d provide demand/retraction framework affecting damages against media defendants.",
    hasAntiSlapp: true,
    antiSlappGrade: "A+",
    antiSlappStatute: "Cal. Code Civ. Proc. § 425.16",
    antiSlappScope: "broad speech/petition on public issues",
    antiSlappBurden: "plaintiff must show probability of prevailing after protected activity showing",
    antiSlappFeeShifting: true,
    antiSlappAppeal: true,
    fairReportScope: "qualified",
    privacyTortsRecognized: ALL_PRIVACY_TORTS,
    sources: [
      "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=425.16.&lawCode=CCP",
      "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=340.&lawCode=CCP",
      "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=47.&lawCode=CIV",
    ],
    notes: "Priority state: strong anti-SLAPP, 1-year SOL, all four privacy torts recognized.",
  },
  CO: {
    hasAntiSlapp: true,
    antiSlappGrade: "B",
    antiSlappStatute: "C.R.S. § 13-20-1101",
    antiSlappScope: "broad public-issue speech and petition activity",
    antiSlappBurden: "plaintiff must establish reasonable likelihood of prevailing",
    antiSlappFeeShifting: true,
    antiSlappAppeal: true,
    sources: [
      "https://colorado.public.law/statutes/crs_13-20-1101",
      "https://leg.colorado.gov/bills/hb19-1324",
      "https://www.ifs.org/anti-slapp-states/colorado/",
    ],
    notes: "Priority state: anti-SLAPP codified in 2019 with interlocutory appeal and fee-shifting features.",
  },
  FL: {
    defamationStatute: "Fla. Stat. ch. 770 (procedural protections for defamation/media)",
    retractionStatute: true,
    retractionDetails: "Fla. Stat. §§ 770.01-.02 require pre-suit notice in many media actions and provide mitigation via retraction.",
    hasAntiSlapp: true,
    antiSlappGrade: "C",
    antiSlappStatute: "Fla. Stat. § 768.295",
    antiSlappScope: "speech on public issues with less robust procedure than UPEPA-style statutes",
    antiSlappBurden: "defendant may seek expedited resolution where suit targets protected speech",
    antiSlappFeeShifting: true,
    antiSlappAppeal: null,
    privacyTortsRecognized: [
      "intrusion_upon_seclusion",
      "public_disclosure_private_facts",
      "appropriation_of_name_or_likeness",
    ],
    falseLightRecognized: false,
    falseLightNote: "Rejected by Florida Supreme Court in Jews for Jesus, Inc. v. Rapp (2008).",
    sources: [
      "https://www.flsenate.gov/Laws/Statutes/2025/0095.11",
      "https://www.flsenate.gov/Laws/Statutes/2025/768.295",
      "https://www.flsenate.gov/Laws/Statutes/2025/770.01",
    ],
    notes: "Priority state: 2-year SOL and Chapter 770 retraction/notice framework.",
  },
  GA: {
    defamationStatute: "O.C.G.A. §§ 51-5-1 to 51-5-12",
    retractionStatute: true,
    retractionDetails: "O.C.G.A. § 51-5-11 provides mitigation for correction/retraction.",
    hasAntiSlapp: true,
    antiSlappGrade: "C",
    antiSlappStatute: "O.C.G.A. § 9-11-11.1",
    antiSlappScope: "petition/speech on public issues",
    antiSlappBurden: "verified pleading + statutory dismissal framework",
    antiSlappFeeShifting: true,
    antiSlappAppeal: null,
    criminalDefamation: true,
    criminalDefStatute: "O.C.G.A. § 16-11-40",
    sources: [
      "https://law.justia.com/codes/georgia/2020/title-9/chapter-11/article-3/section-9-11-11-1/",
      "https://law.justia.com/codes/georgia/title-9/chapter-3/article-2/section-9-3-33/",
      "https://law.justia.com/codes/georgia/title-51/chapter-5/section-51-5-11/",
    ],
    notes: "Priority state: anti-SLAPP under O.C.G.A. § 9-11-11.1 and 1-year SOL.",
  },
  IL: {
    defamationStatute: null,
    hasAntiSlapp: true,
    antiSlappGrade: "B",
    antiSlappStatute: "735 ILCS 110/1 et seq. (Citizen Participation Act)",
    antiSlappScope: "focused on petition/speech tied to government participation",
    antiSlappBurden: "moving party must show suit is solely based on protected participation",
    antiSlappFeeShifting: true,
    antiSlappAppeal: true,
    sources: [
      "https://www.ilga.gov/legislation/ilcs/ilcs3.asp?ActID=3572",
      "https://www.ilga.gov/legislation/ilcs/documents/073500050K13-201.htm",
      "https://www.ifs.org/anti-slapp-states/illinois/",
    ],
    notes: "Priority state: 1-year SOL; anti-SLAPP exists but narrower than broad UPEPA statutes.",
  },
  MI: {
    hasAntiSlapp: true,
    antiSlappGrade: null,
    antiSlappStatute: "Michigan Public Expression Protection Act (2025, enacted via HB 4045; codification updates pending)",
    antiSlappScope: "UPEPA-style speech/petition protections",
    antiSlappBurden: "movant shows protected-expression claim; nonmovant must establish prima facie merit",
    antiSlappFeeShifting: true,
    antiSlappAppeal: true,
    sources: [
      "https://www.ifs.org/blog/michigan-becomes-the-39th-state-to-adopt-an-anti-slapp-law/",
      "https://www.ifs.org/anti-slapp-states/michigan/",
      "https://www.legislature.mi.gov/",
    ],
    notes: "Priority state: reflects late-2025 anti-SLAPP enactment; check final codified cite in Michigan Compiled Laws.",
  },
  NC: {
    hasAntiSlapp: false,
    falseLightRecognized: false,
    falseLightNote: "North Carolina has declined to recognize false light privacy tort claims.",
    privacyTortsRecognized: [
      "intrusion_upon_seclusion",
      "public_disclosure_private_facts",
      "appropriation_of_name_or_likeness",
    ],
    criminalDefamation: true,
    criminalDefStatute: "N.C. Gen. Stat. § 14-47",
    sources: [
      "https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_1/GS_1-54.html",
      "https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_14/GS_14-47.html",
      "https://www.ifs.org/anti-slapp-states/north-carolina/",
    ],
    notes: "Priority state: 1-year SOL and no broad anti-SLAPP statute.",
  },
  NY: {
    defamationStatute: null,
    fairReportStatute: "N.Y. Civ. Rights Law § 74",
    hasAntiSlapp: true,
    antiSlappGrade: "A-",
    antiSlappStatute: "N.Y. Civ. Rights Law §§ 70-a, 76-a",
    antiSlappScope: "broad public-interest speech and petition activity",
    antiSlappBurden: "plaintiff in covered action must show substantial basis; actual malice standard broadens protections",
    antiSlappFeeShifting: true,
    antiSlappAppeal: true,
    privacyTortsRecognized: ["appropriation_of_name_or_likeness"],
    falseLightRecognized: false,
    falseLightNote: "New York does not recognize common-law false light (Howell v. New York Post Co.).",
    sources: [
      "https://www.nysenate.gov/legislation/laws/CVP/215",
      "https://www.nysenate.gov/legislation/laws/CVR/70-A",
      "https://www.nysenate.gov/legislation/laws/CVR/76-A",
    ],
    notes: "Priority state: anti-SLAPP under Civil Rights Law §§ 70-a, 76-a; 1-year SOL; false light not recognized.",
  },
  OH: {
    hasAntiSlapp: true,
    antiSlappGrade: "A+",
    antiSlappStatute: "Ohio Rev. Code §§ 2747.01-.06 (UPEPA, effective Apr. 9, 2025)",
    antiSlappScope: "broad protected public expression on matters of public concern",
    antiSlappBurden: "dismissal unless responding party establishes prima facie case and movant lacks valid defense",
    antiSlappFeeShifting: true,
    antiSlappAppeal: true,
    sources: [
      "https://codes.ohio.gov/ohio-revised-code/chapter-2747",
      "https://www.legislature.ohio.gov/legislation/135/sb237",
      "https://www.ifs.org/anti-slapp-states/ohio/",
    ],
    notes: "Priority state: reflects 2025 enactment of Ohio UPEPA.",
  },
  PA: {
    hasAntiSlapp: true,
    antiSlappGrade: "A",
    antiSlappStatute: "42 Pa.C.S. § 8320.1 et seq. (as amended by Act 72 of 2024)",
    antiSlappScope: "UPEPA-style immunity for protected public expression",
    antiSlappBurden: "early special motion practice with plaintiff merit showing required",
    antiSlappFeeShifting: true,
    antiSlappAppeal: true,
    sources: [
      "https://www.rcfp.org/anti-slapp-guide/pennsylvania/",
      "https://www.speakfreepa.org/",
      "https://www.ifs.org/anti-slapp-states/pennsylvania/",
    ],
    notes: "Priority state: anti-SLAPP significantly expanded in 2024.",
  },
  TN: {
    hasAntiSlapp: true,
    antiSlappGrade: "A",
    antiSlappStatute: "Tenn. Code Ann. §§ 20-17-101 to 20-17-110 (Tennessee Public Participation Act)",
    antiSlappScope: "broad public-concern expression/petition coverage",
    antiSlappBurden: "moving party shows covered communication; responding party must establish prima facie claim",
    antiSlappFeeShifting: true,
    antiSlappAppeal: true,
    sources: [
      "https://law.justia.com/codes/tennessee/title-20/chapter-17/section-20-17-103/",
      "https://www.capitol.tn.gov/Bills/111/Bill/SB1097.pdf",
      "https://www.ifs.org/anti-slapp-states/tennessee/",
    ],
    notes: "Priority state: Tennessee Public Participation Act and 1-year SOL.",
  },
  TX: {
    defamationStatute: "Tex. Civ. Prac. & Rem. Code § 73.001",
    retractionStatute: true,
    retractionDetails: "Tex. Civ. Prac. & Rem. Code ch. 73 includes mitigation/retraction provisions for media defendants.",
    hasAntiSlapp: true,
    antiSlappGrade: "A+",
    antiSlappStatute: "Tex. Civ. Prac. & Rem. Code ch. 27 (TCPA)",
    antiSlappScope: "broad constitutional rights activity with statutory exemptions",
    antiSlappBurden: "movant shows legal action is based on protected right; nonmovant must establish prima facie case",
    antiSlappFeeShifting: true,
    antiSlappAppeal: true,
    privacyTortsRecognized: [
      "intrusion_upon_seclusion",
      "public_disclosure_private_facts",
      "appropriation_of_name_or_likeness",
    ],
    falseLightRecognized: false,
    falseLightNote: "Texas Supreme Court declined to recognize false light in Cain v. Hearst Corp. (1994).",
    sources: [
      "https://statutes.capitol.texas.gov/Docs/CP/htm/CP.16.htm#16.002",
      "https://statutes.capitol.texas.gov/Docs/CP/htm/CP.27.htm",
      "https://law.justia.com/cases/texas/supreme-court/1994/c-766-0.html",
    ],
    notes: "Priority state: TCPA anti-SLAPP and 1-year SOL set explicitly.",
  },
  VA: {
    hasAntiSlapp: true,
    antiSlappGrade: "D",
    antiSlappStatute: "Va. Code § 8.01-223.2",
    antiSlappScope: "immunity for specified public-concern and petitioning statements",
    antiSlappBurden: "defendant invokes statutory immunity; falsity/recklessness exceptions apply",
    antiSlappFeeShifting: true,
    antiSlappAppeal: true,
    falseLightRecognized: false,
    falseLightNote: "Virginia generally does not recognize a standalone false light tort.",
    privacyTortsRecognized: [
      "intrusion_upon_seclusion",
      "public_disclosure_private_facts",
      "appropriation_of_name_or_likeness",
    ],
    sources: [
      "https://law.lis.virginia.gov/vacodeupdates/title8.01/section8.01-223.2/",
      "https://law.lis.virginia.gov/vacode/title8.01/chapter3/section8.01-247.1/",
      "https://www.rcfp.org/anti-slapp-guide/virginia/",
    ],
    notes: "Priority state: anti-SLAPP remains narrower and more immunity-focused than UPEPA models.",
  },
  WA: {
    hasAntiSlapp: true,
    antiSlappGrade: "A",
    antiSlappStatute: "RCW 4.105 (Uniform Public Expression Protection Act)",
    antiSlappScope: "broad protected-expression coverage under UPEPA model",
    antiSlappBurden: "moving party must show covered claim; responding party must establish prima facie merit",
    antiSlappFeeShifting: true,
    antiSlappAppeal: true,
    sources: [
      "https://lawfilesext.leg.wa.gov/Law/RCW/RCW%20%20%204%20%20TITLE/RCW%20%20%204%20.105%20%20CHAPTER/RCW%20%20%204%20.105%20%20CHAPTER.htm",
      "https://www.ifs.org/anti-slapp-states/washington/",
      "https://app.leg.wa.gov/rcw/default.aspx?cite=4.16.100",
    ],
    notes: "Priority state: reflects replacement of prior unconstitutional regime with UPEPA statute.",
  },
};

function buildStateRecord(state: string, abbrev: string): StateLawSeed {
  const override = OVERRIDES[abbrev] ?? {};
  const falseLightRecognized = override.falseLightRecognized ?? !NO_FALSE_LIGHT.has(abbrev);
  const privacyTortsRecognized =
    override.privacyTortsRecognized ??
    (falseLightRecognized
      ? [...ALL_PRIVACY_TORTS]
      : [
          "intrusion_upon_seclusion",
          "public_disclosure_private_facts",
          "appropriation_of_name_or_likeness",
        ]);

  return {
    state,
    abbrev,
    ...BASE_RECORD,
    libelSOL: SOL_YEARS[abbrev],
    slanderSOL: SOL_YEARS[abbrev],
    solStatute: SOL_STATUTES[abbrev] ?? null,
    falseLightRecognized,
    falseLightNote:
      override.falseLightNote ??
      (falseLightRecognized ? null : "Jurisdiction generally does not recognize false light as an independent tort."),
    criminalDefamation: override.criminalDefamation ?? CRIMINAL_DEF_STATES.has(abbrev),
    criminalDefStatute:
      override.criminalDefStatute ?? (CRIMINAL_DEF_STATES.has(abbrev) ? "State criminal defamation/libel provisions (verify current enforceability)" : null),
    standardOfFault: { ...BASE_RECORD.standardOfFault, ...(override.standardOfFault ?? {}) },
    perSeCategories: [...(override.perSeCategories ?? BASE_RECORD.perSeCategories)],
    privacyTortsRecognized: [...privacyTortsRecognized],
    sources: [...(override.sources ?? BASE_RECORD.sources)],
    ...override,
  };
}

export const STATE_DEFAMATION_DATA: StateLawSeed[] = STATE_LIST.map(({ state, abbrev }) =>
  buildStateRecord(state, abbrev),
);
