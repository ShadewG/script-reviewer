/**
 * YouTube Policy Database for True Crime Documentary Script Review
 * ================================================================
 * This file embeds verbatim YouTube policy text for use as LLM prompt context
 * in Stage 2 of a YouTube script compliance review tool.
 *
 * Source: support.google.com/youtube
 * Last Fetched: 2026-02-26
 * Version: 1.0.0
 *
 * NOTE ON TEXT SOURCES:
 * - Policies 1–13, 15–20: Verbatim text fetched directly from YouTube Help pages
 * - Policy 14 (Thumbnails/answer/9229980): Page was unavailable; content reconstructed
 *   from the Age-Restricted Content page and Advertiser-Friendly guidelines where
 *   thumbnails are discussed. Successfully fetched via browser on second attempt.
 *
 * Target audience: True crime documentary channel based in Norway.
 */

// ============================================================
// TYPESCRIPT INTERFACES
// ============================================================

export type PolicyCategory =
  | "community_guidelines"
  | "advertiser_friendly"
  | "enforcement"
  | "content_rating";

export type RelevanceLevel = "critical" | "high" | "medium" | "low";

export interface PolicySection {
  title: string;
  content: string;
}

export interface YTPolicyEntry {
  /** Slug identifier, e.g. "violent-graphic-content" */
  id: string;
  /** Full display name of the policy */
  name: string;
  /** Which policy regime this falls under */
  category: PolicyCategory;
  /** Canonical YouTube Help URL */
  sourceUrl: string;
  /** Date the content was fetched (YYYY-MM-DD) */
  lastFetched: string;
  /** How relevant this policy is for true crime documentary content */
  relevanceToTrueCrime: RelevanceLevel;
  /** Brief explanation of why/how this policy matters for true crime docs */
  trueCrimeNotes: string;
  /** Full policy text broken into logical sections (verbatim where available) */
  sections: PolicySection[];
  /** Specific things NOT allowed under this policy */
  prohibitedContent: string[];
  /** Things that may receive age-restriction rather than removal */
  ageRestrictedContent: string[];
  /** What is explicitly permitted under Educational/Documentary/Scientific/Artistic context */
  edsaExceptions: string[];
  /** Consequences when this policy is violated */
  enforcementActions: string[];
}

export interface MonetizationCategory {
  /** Category name as used in the Advertiser-Friendly Content Guidelines */
  category: string;
  /** What qualifies for full ad monetization */
  fullAdsDescription: string;
  /** What gets limited or no ads */
  limitedAdsDescription: string;
  /** What gets zero ad revenue */
  noAdsDescription: string;
  /** Specific examples relevant to true crime documentary content */
  trueCrimeExamples: string[];
}

export interface PolicyMetadata {
  totalPolicies: number;
  lastUpdated: string;
  version: string;
  /** IDs of policies rated critical or high relevance for true crime */
  trueCrimeRelevantPolicies: string[];
}

// ============================================================
// POLICY 1: VIOLENT OR GRAPHIC CONTENT
// ============================================================

const violentGraphicContent: YTPolicyEntry = {
  id: "violent-graphic-content",
  name: "Violent or Graphic Content",
  category: "community_guidelines",
  sourceUrl: "https://support.google.com/youtube/answer/2802008",
  lastFetched: "2026-02-26",
  relevanceToTrueCrime: "critical",
  trueCrimeNotes:
    "True crime documentaries frequently reference crime scene imagery, surveillance footage, courtroom evidence, and descriptions of violent acts. This is arguably the most critical policy for the genre. The EDSA documentary exception is the primary shield, but context must appear in the video/audio itself — not only in the description. Gratuitous framing without editorial purpose will trigger removal.",
  sections: [
    {
      title: "Overview",
      content:
        "Violent or gory content intended to shock or disgust viewers, or content encouraging others to commit violent acts, are not allowed on YouTube. In some cases, we may make exceptions for content with educational, documentary, scientific, or artistic context, including content that is in the public's interest.\n\nIf you believe anyone is in imminent danger, you should get in touch with your local law enforcement agency to report the situation immediately.",
    },
    {
      title: "Prohibited Violent or Graphic Content",
      content:
        "Don't post content on YouTube if it fits any of the descriptions noted below.\n\nViolent or graphic content:\n- Inciting others to commit violent acts against individuals or a defined group of people.\n- Fights involving minors.\n- Footage, audio, or imagery involving road accidents, terrorist attack aftermath, street fights, physical attacks, immolation, torture, corpses, robberies, or other such scenarios with the intent to shock or disgust viewers.\n- Footage or imagery showing bodily fluids, such as blood or vomit, with the intent to shock or disgust viewers.\n- Footage of corpses with massive injuries, such as severed limbs.",
    },
    {
      title: "Animal Abuse Content",
      content:
        "Animal abuse content not allowed includes:\n- Content where humans coerce animals to fight.\n- Content where a human maliciously mistreats an animal and causes them to experience distress outside of traditional or standard practices. Examples of traditional or standard practices include hunting or food preparation.\n- Content where a human unnecessarily puts an animal in poor conditions outside of traditional or standard practices.\n- Content that glorifies or promotes serious neglect, mistreatment, or harm toward animals.\n- Content that shows animal rescue that is staged and puts the animal in harmful scenarios.\n- Graphic content that features animals and intends to shock or disgust.",
    },
    {
      title: "Dramatized or Fictional Content",
      content:
        "Dramatized or fictional footage of content prohibited by these guidelines where the viewer is not given enough context to understand that the footage is dramatized or fictional is not allowed.\n\nNote that we may not allow the following kinds of content even if there's educational, documentary, scientific, or artistic context provided:\n- Violent physical sexual assaults (video, still imagery, or audio).\n- Footage filmed by the perpetrator during a deadly or major violent event, in which weapons, violence, or injured victims are visible or audible.",
    },
    {
      title: "Educational Content / EDSA Exception",
      content:
        "We may allow the kinds of violent or graphic content noted above in some cases in educational, documentary, scientific, or artistic content. This is not a pass to upload content meant to shock or disgust, or encourage others to commit violent acts, and we may not make these exceptions for certain kinds of content, like footage of violent physical sexual assault.\n\nFor educational content containing the kinds of violent or graphic content noted above, this context must appear in the images or audio of the video itself. Providing it in the title or description is insufficient.\n\nFor educational, documentary, scientific, or artistic content that has adult material or graphic violence, we may take into account official third-party industry ratings to decide whether the content may remain on YouTube. Content that follows our policies but isn't appropriate for all audiences is age-restricted. Age-restricted content isn't viewable to anyone who's under 18 years of age or signed out.",
    },
    {
      title: "Age-Restricted Content and EDSA Exceptions",
      content:
        "We may apply an age-restriction rather than remove violent or graphic content if that content provides enough context to understand it. For example, content showing victims' injuries in a road accident may be removed, but we may age-restrict that same content if presented with news coverage that explains the situation and context. For educational use of violent or graphic content, this context must appear in the images or audio of the video itself.\n\nWe may also consider whether content is in the public's interest when deciding whether content should be allowed, age-restricted, or removed. For example, we may allow or age-restrict graphic or violent content documenting warzones, civil unrest, humanitarian crises, or natural disasters with adequate educational, documentary, scientific or artistic context in the images or audio of the video, the video title, or the video description. We may also make exceptions for content such as congressional or parliamentary proceedings, campaign speeches, or debates over ongoing government actions.\n\nWe may age-restrict dramatized violence when it contains graphic scenes, such as mass violence against non-combatants or people being tortured, dismembered, or decapitated. We may also age-restrict content that focuses on human corpses with these severe injuries or violent deaths of a person that show blood.",
    },
    {
      title: "Decision Factors",
      content:
        "We consider the following when deciding whether to allow, age-restrict or remove content:\n- Whether violent or gory imagery is the focus of the video. For example, the video focuses solely on the most graphically violent part of a film or video game.\n- Whether the title, description, tags, or other data show an intent to shock or disgust viewers.\n- Whether violent imagery or audio has been blurred, masked, or obscured.\n- The amount of time the violent images or audio is in the content.\n- Whether there's context that lets viewers know that the imagery is dramatized or fictional.\n- Whether the violence is part of a religious or cultural practice, and the uploader gives viewers that context.\n- Whether the content shows the killing of an animal via traditional or standard practices for hunting, religious practice, or food preparation.\n- Whether the dramatized violence is depicted with real human actors or animation including video games.",
    },
    {
      title: "Examples of Prohibited Content",
      content:
        "Here are some examples of content that's not allowed on YouTube:\n- Encouraging others to go to a particular place to commit violence, to perform violence at a particular time, or to target individuals or groups with violence.\n- Actual schoolyard fights between minors.\n- Beatings or brawls outside the context of professional or professionally supervised sporting events.\n- Content that shows medical procedure footage with the intent to shock or disgust viewers.\n- Footage of crimes such as violent robberies that provide no education or explanation to viewers.\n- Cell phone, dash cam, or closed circuit TV footage showing the injured or killed in a road accident accompanied by titles such as \"Crazy accident\" or \"Warning: Lots of blood.\"\n- Videos of beheadings.\n- One-sided assaults with titles like \"Watch this guy get beat-up!\".",
    },
    {
      title: "Enforcement",
      content:
        "If your content violates this policy, we will remove the content and send you an email to let you know. If this is your first time violating our Community Guidelines, you'll likely get a warning with no penalty to your channel. You will have the option to take a policy training to allow the warning to expire after 90 days. If you get 3 strikes within 90 days, your channel may be terminated. We may terminate your channel or account after a single case of severe abuse, or when the channel is dedicated to a policy violation.",
    },
  ],
  prohibitedContent: [
    "Inciting others to commit violent acts against individuals or a defined group of people",
    "Fights involving minors",
    "Footage/audio/imagery of road accidents, terrorist attack aftermath, street fights, physical attacks, immolation, torture, corpses, robberies with intent to shock or disgust",
    "Footage showing bodily fluids such as blood or vomit with intent to shock or disgust",
    "Footage of corpses with massive injuries, such as severed limbs",
    "Violent physical sexual assaults (video, still imagery, or audio) — not even allowed with EDSA context",
    "Footage filmed by perpetrator during a deadly/major violent event where weapons, violence, or injured victims are visible or audible",
    "Content glorifying or promoting animal abuse",
    "Dramatized/fictional violent content where viewer is not given enough context to understand it is fictional",
  ],
  ageRestrictedContent: [
    "Violent or graphic content that provides enough context to understand it (e.g., news coverage of road accident injuries)",
    "Graphic or violent content documenting warzones, civil unrest, humanitarian crises with adequate EDSA context",
    "Dramatized violence with graphic scenes of mass violence against non-combatants, torture, dismemberment, decapitation",
    "Content focusing on human corpses with severe injuries or violent deaths showing blood",
    "Dramatized violence where real human actors (not animation) depict particularly graphic or realistic scenarios",
  ],
  edsaExceptions: [
    "News reporting on violent events with journalistic context in video/audio",
    "Documentaries about violent events, crimes, or historical violence with clear editorial purpose",
    "Educational analysis of violent acts where context appears in images or audio of the video itself",
    "Congressional/parliamentary proceedings, campaign speeches, debates over government actions",
    "Content documenting warzones, civil unrest, humanitarian crises with adequate EDSA context",
    "Public interest content about violent events — but context must be in the video itself, not just title/description",
  ],
  enforcementActions: [
    "Content removal and email notification",
    "First violation: Warning with no channel penalty (option to take policy training to expire warning after 90 days)",
    "Subsequent violations of same policy within 90-day window: Strike",
    "First strike: 1-week posting ban",
    "Second strike within 90 days: 2-week posting ban",
    "Third strike within 90 days: Channel termination",
    "Single case of severe abuse: Channel termination without waiting for 3 strikes",
  ],
};

// ============================================================
// POLICY 2: NUDITY AND SEXUAL CONTENT
// ============================================================

const nuditySexualContent: YTPolicyEntry = {
  id: "nudity-sexual-content",
  name: "Nudity and Sexual Content",
  category: "community_guidelines",
  sourceUrl: "https://support.google.com/youtube/answer/2802002",
  lastFetched: "2026-02-26",
  relevanceToTrueCrime: "medium",
  trueCrimeNotes:
    "Some true crime cases involve sexual crimes (rape, trafficking, sexual assault). Scripts must handle descriptions of sexual crimes without presenting them in a gratuitous or titillating manner. Documentary context is generally allowed when not gratuitous. Particular care needed around cases involving minors. Avoid graphic descriptions or re-enactments of sexual assault.",
  sections: [
    {
      title: "Overview",
      content:
        "Explicit content meant to be sexually gratifying is not allowed on YouTube. Posting pornography may result in content removal or channel termination. Videos containing fetish content will be removed or age-restricted. In most cases, violent, graphic, or humiliating fetishes are not allowed on YouTube. In some cases, we may make exceptions for content with educational, documentary, scientific, or artistic context, including content that is in the public's interest.\n\nSexually explicit content featuring minors and content that sexually exploits minors is not allowed on YouTube. We report content containing child sexual abuse imagery to the National Center for Missing and Exploited Children, who work with global law enforcement agencies.",
    },
    {
      title: "Prohibited Content",
      content:
        "Don't post content on YouTube if it shows:\n- The depiction of clothed or unclothed genitals, breasts, or buttocks that are meant for sexual gratification.\n- Pornography, the depiction of sexual acts, or fetishes that are meant for sexual gratification.\n\nOther types of content that violate this policy:\n- Masturbation\n- Fondling or groping of genitals, breasts, or buttocks\n- Using sex toys to give viewers sexual gratification\n- Nudity or partial nudity that's meant for sexual gratification\n- Non-consensual sex acts or the promotion or glorification of non-consensual sex acts, such as sexual assault, incest, bestiality, or zoophilia\n- Unwanted sexualization such as non-consensually shared imagery or voyeurism\n- Wardrobe accidents or nude photo leaks\n- Non-consensual zooming in or prolonged focused or emphasis on the breasts, buttocks or genital area for the purpose of sexual gratification\n- Violent, graphic, or humiliating fetish content where the purpose is sexual gratification\n- Aggregating content that's meant for sexual gratification\n- Any sexual content involving minors",
    },
    {
      title: "Age-Restricted Content",
      content:
        "We may age-restrict content if it includes nudity or other sexual content but doesn't depict anything described above. We consider the following when deciding whether to age-restrict or remove content:\n- Whether clothed or unclothed breasts, buttocks or genitals are the focal point of the video\n- Whether the subject is depicted in a pose that is intended to sexually arouse the viewer\n- Whether the language used in the video is graphic or lewd\n- Whether the subject's actions in the video encourage sexual arousal, such as by touching of breasts or genitals, or revealing undergarments\n- Whether the clothing would be generally unacceptable in public contexts, such as lingerie\n- Whether sexual imagery or audio has been blurred, masked, or obscured\n- Whether sexual imagery or audio is fleeting or prolonged in the content\n- Whether the content invites others to participate in a challenge involving sexual acts",
    },
    {
      title: "Educational Content Exception",
      content:
        "We may allow sexual content when the primary purpose is educational, documentary, scientific, or artistic, and it isn't gratuitous. We may also make exceptions for content that is in the public's interest, such as congressional or parliamentary proceedings, campaign speeches, or debates over ongoing government actions. This is not a pass to promote sexually explicit content. For example, a documentary on breast cancer that shows nude breasts would be appropriate, but posting clips out of context to sexually gratify from the same documentary is not.\n\nThe same applies to depictions of sex scenes in artistic content such as films, audio stories, music or video games. For example, a film with a sex scene may be allowed if it included details such as the name of the film, director, actors in the video content and in the video description.",
    },
    {
      title: "Examples of Prohibited Content",
      content:
        "Here are some examples of content that's not allowed on YouTube:\n- Clips extracted from non-pornographic films, shows, or other content in order to isolate sexual content\n- Groping, kissing, public masturbation, \"upskirting\", voyeurism, predatory exhibitionism, or any other content that depicts someone in a sexualized manner without their consent\n- Content that depicts sexual acts, behaviors, or sex toys that's meant for sexual gratification\n- Playlists that aggregate content containing nudity or sexual themes for the purpose of sexual gratification\n- Provocative dancing that is focused on the dancer's genitals, buttocks, or breasts, or that includes fondling or groping\n- Content that sexualizes rape in any form, or content that aggregates clips of dramatized rape scenes\n- Audio or textual depictions of sexual acts for the purpose of sexual gratification",
    },
  ],
  prohibitedContent: [
    "Pornography or depiction of sexual acts meant for sexual gratification",
    "Fetish content meant for sexual gratification (violent, graphic, or humiliating fetishes especially)",
    "Non-consensual sex acts or promotion/glorification of non-consensual sex acts including sexual assault",
    "Unwanted sexualization, non-consensually shared imagery, voyeurism",
    "Any sexual content involving minors (reported to NCMEC and global law enforcement)",
    "Aggregating sexually gratifying content",
    "Content that sexualizes rape in any form",
    "Clips extracted from non-pornographic content to isolate sexual content",
  ],
  ageRestrictedContent: [
    "Nudity or sexual content that doesn't rise to the level of pornography but is not appropriate for all ages",
    "Content where clothed or unclothed sexual body parts are the focal point",
    "Content where the subject is in a pose intended to sexually arouse the viewer",
    "Content with graphic or lewd language",
    "Lingerie or revealing clothing used in a sexually suggestive manner",
  ],
  edsaExceptions: [
    "Documentary about sexual crimes — allowed when not gratuitous and primary purpose is educational/journalistic",
    "Documentary on breast cancer, medical conditions involving nudity",
    "Film depicting sex scene when properly contextualized with film title, director, actors info",
    "Sex education content that is not gratuitous",
    "Congressional/parliamentary proceedings involving discussion of sexual topics",
  ],
  enforcementActions: [
    "Content removal and email notification",
    "Channel termination if content contains pornography",
    "First violation: Warning with option for policy training (expires after 90 days)",
    "Repeat violations: Strikes (1 week, then 2 weeks posting ban)",
    "Three strikes within 90 days: Channel termination",
    "Child sexual abuse imagery reported to NCMEC and global law enforcement",
  ],
};

// ============================================================
// POLICY 3: HARASSMENT AND CYBERBULLYING
// ============================================================

const harassmentCyberbullying: YTPolicyEntry = {
  id: "harassment-cyberbullying",
  name: "Harassment and Cyberbullying",
  category: "community_guidelines",
  sourceUrl: "https://support.google.com/youtube/answer/2802268",
  lastFetched: "2026-02-26",
  relevanceToTrueCrime: "critical",
  trueCrimeNotes:
    "True crime documentaries discuss real people — suspects (including unproven/acquitted), victims, witnesses, family members, and officials. Content could be seen as targeting real individuals if it focuses on prolonged insults, reveals personal information (doxxing), denies their victimhood, or encourages audience harassment. The policy also prohibits content that denies or minimizes someone's role as a victim of a well-documented major violent event. The EDSA exception permits discussing public figures in news/documentary contexts, but this is not a pass to harass.",
  sections: [
    {
      title: "Overview",
      content:
        "We don't allow content that targets someone with prolonged insults or slurs based on their physical traits or protected group status. We also don't allow other harmful behaviors, like threats or doxxing. Keep in mind that we take a stricter approach on content that targets minors. In some cases, we may make exceptions for content with educational, documentary, scientific, or artistic context, including content that is in the public's interest.",
    },
    {
      title: "Prohibited Harassment Content",
      content:
        "Don't post content on YouTube if it fits any of the descriptions noted below:\n- Content that contains prolonged insults or slurs based on someone's intrinsic attributes. These attributes include their protected group status, physical attributes, or their status as a survivor of sexual assault, non-consensual intimate imagery distribution, domestic abuse, child abuse and more.\n- Content uploaded with the intent to shame, deceive or insult a minor.\n\nOther types of content that violate this policy:\n- Content that shares, threatens to share, or encourages others to share non-public personally identifiable information (PII). PII includes, but isn't limited to, home addresses; email addresses; sign-in credentials, like a username or password; phone numbers; passport numbers; medical records; bank account information; or the name of a school a minor attends.\n- Content that encourages abusive behavior, like brigading. Brigading is when an individual encourages the coordinated abuse of an identifiable individual on or off YouTube.\n- Content that promotes harmful conspiracy theories or that targets someone by claiming they're a part of a harmful conspiracy theory. A harmful conspiracy theory is one that has been linked to direct threats or violent acts.\n- Content that threatens an identifiable individual or their property. This includes implicit threats that don't specify a time or place but may feature a weapon.\n- Content that depicts a staged meet-up that is used to accuse an identifiable individual of egregious misconduct with a minor, without the presence of law enforcement.\n- Content that depicts vigilantes restraining or assaulting individuals, or engaging in a dangerous or reckless vehicle pursuit to apprehend an individual.\n- Content reveling in or mocking the death or serious injury of an identifiable individual.\n- Content that realistically simulates deceased or abused individuals describing their death or violence experienced.\n- Content that depicts creators simulating acts of serious violence against others. For example, executions, torture, maimings, beatings, and more.\n- Content that contains stalking of an identifiable individual.\n- Content that denies or minimizes someone's role as a victim of a well-documented, major violent event.\n- Content that contains unwanted sexualization of an identifiable individual.",
    },
    {
      title: "EDSA Exceptions",
      content:
        "If the primary purpose is educational, documentary, scientific, or artistic in nature, we may allow content that includes harassment. We may also make exceptions for content that is in the public's interest, such as congressional or parliamentary proceedings, campaign speeches, or debates over ongoing government actions. These exceptions are not a pass to harass someone. Some examples include:\n\n- Debates related to high-profile officials or leaders: Content featuring debates or discussions of topical issues concerning individuals who have positions of power, like high-profile government officials or CEOs of major multinational corporations.\n- Scripted performances: Insults made in the context of an artistic medium such as scripted satire, stand up comedy, or music (such as a diss track). Note: This exception is not a pass to harass someone and claim \"I was joking.\"\n- Harassment education or awareness: Content that features actual or simulated harassment for documentary purposes or with willing participants (such as actors) to combat cyberbullying or raise awareness.\n\nNote: We take a harder line on content that maliciously insults someone based on their protected group status, regardless of whether or not they are a high-profile individual.",
    },
    {
      title: "Monetization and Other Penalties",
      content:
        "In some rare cases, we may remove content or issue other penalties when a creator:\n- Repeatedly encourages abusive audience behavior.\n- Repeatedly targets, insults and abuses an identifiable individual based on their intrinsic attributes across several uploads.\n- Exposes an individual to risks of physical harm based on the local social or political context.\n- Creates content that harms the YouTube community by persistently inciting hostility between creators for personal financial gain.",
    },
    {
      title: "Examples of Prohibited Content",
      content:
        "Here are some examples of content that's not allowed on YouTube:\n- Repeatedly showing pictures of someone and then making statements like \"Look at this creature's teeth, they're so disgusting!\", with similar commentary targeting intrinsic attributes throughout the video.\n- Targeting an individual based on their membership in a protected group, such as by saying: \"Look at this [slur targeting a protected group]!\"\n- Using an extreme insult to dehumanize an individual based on their intrinsic attributes.\n- Targeting an individual and expressing a wish for their death or serious injury: \"I hate her so much. I wish she'd just get hit by a truck and die.\"\n- Depicting an identifiable individual being murdered or seriously injured.\n- Threatening someone's physical safety.\n- Posting an individual's non-public personally identifiable information, like a phone number, home address, or email address, to direct abusive attention or traffic toward them.\n- \"Raiding\" or directing malicious abuse to identifiable individuals through in-game voice chat or messages during a stream.\n- Directing users to leave abusive comments in another creator's comment section.\n- \"Swatting\" or other prank calls to emergency or crisis response services, or encouraging viewers to act in this or any other harassing behavior.\n- Stalking or attempting to blackmail users.",
    },
  ],
  prohibitedContent: [
    "Prolonged insults or slurs based on someone's intrinsic attributes or protected group status",
    "Content intended to shame, deceive, or insult a minor",
    "Sharing or threatening to share non-public personally identifiable information (PII) — home addresses, phone numbers, medical records, minor's school name",
    "Encouraging coordinated abuse/brigading against an identifiable individual",
    "Promoting harmful conspiracy theories that target a specific person",
    "Threatening an identifiable individual or their property (including implicit threats with weapons)",
    "Vigilante content depicting restraining or assaulting individuals",
    "Mocking or reveling in the death or serious injury of an identifiable individual",
    "Stalking an identifiable individual",
    "Content denying or minimizing someone's role as a victim of a well-documented major violent event",
    "Unwanted sexualization of an identifiable individual",
    "Content simulating deceased or abused individuals describing their death or violence",
  ],
  ageRestrictedContent: [
    "Content discussing real harassment or difficult situations in documentary/educational context may be age-restricted rather than removed",
  ],
  edsaExceptions: [
    "Debates and discussions about high-profile officials or public figures in positions of power (politicians, executives) in news/documentary context",
    "Scripted satire or comedy that includes sharp criticism of public figures",
    "Educational content about harassment, cyberbullying, or abuse patterns for awareness purposes",
    "Congressional/parliamentary proceedings, campaign speeches",
    "Documentary discussion of real criminal cases where suspects, victims, and witnesses are named in journalistic context",
  ],
  enforcementActions: [
    "Content removal and email notification",
    "First violation: Warning with option for policy training (expires after 90 days)",
    "Repeat violations: Strikes (1 week, then 2 weeks posting ban)",
    "Three strikes within 90 days: Channel termination",
    "Repeated targeting of individuals may trigger additional monetization penalties beyond standard strike system",
    "Channel termination for severe or repeated abuse",
  ],
};

// ============================================================
// POLICY 4: HATE SPEECH
// ============================================================

const hateSpeech: YTPolicyEntry = {
  id: "hate-speech",
  name: "Hate Speech",
  category: "community_guidelines",
  sourceUrl: "https://support.google.com/youtube/answer/2801939",
  lastFetched: "2026-02-26",
  relevanceToTrueCrime: "medium",
  trueCrimeNotes:
    "True crime scripts must avoid attributing criminal behavior to protected characteristics or making generalizations that dehumanize groups. Covering hate crimes requires special care — reporting on the crime and condemning it is allowed; promoting the perpetrator's ideology is not. For racially or religiously motivated crimes, educational/documentary framing is essential. The policy also prohibits denying well-documented major violent events.",
  sections: [
    {
      title: "Overview",
      content:
        "Hate speech is not allowed on YouTube. We don't allow content that promotes violence or hatred against individuals or groups based on any of the following attributes, which indicate a protected group status under YouTube's policy:\n- Age\n- Caste, Ethnicity, or Race\n- Disability\n- Immigration Status\n- Nationality\n- Religion\n- Sex, Gender, or Sexual Orientation\n- Veteran Status\n- Victims of a major violent event and their kin\n\nIn some cases, we may make exceptions for content with educational, documentary, scientific, or artistic context, including content that is in the public's interest.",
    },
    {
      title: "What This Policy Prohibits",
      content:
        "Don't post content on YouTube if the purpose of that content is to do one or more of the following:\n- Encourage violence against individuals or groups based on their protected group status. We don't allow threats on YouTube, and we treat implied calls for violence as real threats.\n- Incite hatred against individuals or groups based on their protected group status.\n\nOther types of content that violates this policy:\n- Dehumanization of individuals or groups by calling them subhuman, comparing them to animals, insects, pests, disease, or any other non-human entity based on their protected group status.\n- Praise or glorification of violence against individuals or groups based on their protected group status.\n- Use of racial, religious, or other slurs and stereotypes that incite or promote hatred based on protected group status. This can take the form of speech, text, or imagery promoting these stereotypes or treating them as factual.\n- Claim that individuals or groups are physically or mentally inferior, deficient, or diseased based on their protected group status.\n- Promotion of hateful supremacism by alleging the superiority of a group over those with protected group status to justify violence, discrimination, segregation, or exclusion. This includes content containing hateful supremacist propaganda, such as the recruitment of new members or requests for financial support for their ideology, and music videos promoting hateful supremacism in the lyrics, metadata, or imagery.\n- Conspiratorial claims that individuals or groups are evil, corrupt, or malicious based on their protected group status.\n- Denial or minimization of a well-documented, major violent event or the victimhood of such an event.",
    },
    {
      title: "Educational, Documentary, Scientific, and Artistic Content",
      content:
        "We may allow content that includes hate speech if that content includes additional educational, documentary, scientific, or artistic context. Additional context may include condemning, refuting, including opposing views, or satirizing hate speech. We may also make exceptions for content that is in the public's interest, such as congressional or parliamentary proceedings, campaign speeches, or debates over ongoing government actions.\n\nExamples of allowed EDSA content:\n- A documentary about a hate group: Educational content that isn't supporting the group or promoting ideas would be allowed. A documentary promoting violence or hatred wouldn't be allowed.\n- A documentary about the scientific study of humans: A documentary about how theories have changed over time, even if it includes theories about the inferiority or superiority of specific groups, would be allowed because it's educational.\n- Historical footage of an event, like WWII, which doesn't promote violence or hatred.\n\nFor educational, documentary, scientific, or artistic content that includes hate speech, this context must appear in the images or audio of the video itself. Providing it in the title or description is insufficient.",
    },
    {
      title: "Examples of Hate Speech Not Allowed",
      content:
        "- \"I'm glad this [violent event] happened. They got what they deserved [referring to people with protected group status].\"\n- \"[People with protected group status] are dogs\" or \"[people with protected group status] are like animals.\"\n- \"Get out there and punch a [person with protected group status].\"\n- \"[Person with protected group status] is scum of the earth.\"\n- \"[People with protected group status] are a disease.\"\n- \"[People with protected group status] are less intelligent than us because their brains are smaller.\"\n- \"[Group with protected group status] have an agenda to run the world and get rid of us.\"\n- \"All of the so-called victims of this violent event are actors. No one was hurt, and this is just a false flag.\"\n- \"People died in the event, but a truly insignificant number.\"\n- Video game content which has been developed or modified (\"modded\") to promote violence or hatred against a group.",
    },
  ],
  prohibitedContent: [
    "Encouraging violence against protected groups (age, caste, ethnicity, race, disability, immigration status, nationality, religion, sex, gender, sexual orientation, veteran status, victims of major violent events)",
    "Inciting hatred against protected groups",
    "Dehumanizing language comparing protected groups to animals, insects, pests, or diseases",
    "Praise or glorification of violence against protected groups",
    "Racial, religious, or other slurs used to incite or promote hatred",
    "Claims that protected groups are physically or mentally inferior",
    "Hateful supremacist propaganda including recruitment content",
    "Conspiratorial claims that groups are evil or corrupt based on protected group status",
    "Denial or minimization of a well-documented major violent event or victims of such events",
  ],
  ageRestrictedContent: [
    "Historical footage or educational content discussing hate speech/ideology that doesn't promote it but may contain disturbing content",
  ],
  edsaExceptions: [
    "Documentary about a hate group that is critical/educational and does not promote the group's ideology",
    "Historical footage of events like WWII that doesn't promote violence or hatred",
    "Documentary about the scientific study of humans discussing historical theories (without presenting them as fact)",
    "Content condemning, refuting, or satirizing hate speech — EDSA context must appear in video/audio itself",
    "Congressional/parliamentary proceedings, campaign speeches, debates over government actions",
  ],
  enforcementActions: [
    "Content removal and email notification",
    "First violation: Warning with option for policy training (expires after 90 days)",
    "Repeat violations: Strikes (1 week, then 2 weeks posting ban)",
    "Three strikes within 90 days: Channel termination",
    "Additional monetization penalties for repeated targeting of groups based on protected group status",
  ],
};

// ============================================================
// POLICY 5: VULGAR LANGUAGE
// ============================================================

const vulgarLanguage: YTPolicyEntry = {
  id: "vulgar-language",
  name: "Vulgar Language",
  category: "community_guidelines",
  sourceUrl: "https://support.google.com/youtube/answer/10072685",
  lastFetched: "2026-02-26",
  relevanceToTrueCrime: "high",
  trueCrimeNotes:
    "True crime narration may quote direct speech from criminals, victims, court transcripts, or recorded phone calls containing profanity. Heavy profanity in the video title or thumbnail will eliminate monetization. Strong profanity in the first 8 seconds of the video triggers limited ads. A documentary context (quoting real speech) is recognized as an EDSA exception, but profanity in titles/thumbnails is still a hard monetization problem regardless of context.",
  sections: [
    {
      title: "Overview",
      content:
        "Content that may contain language not appropriate for viewers under 18 years of age. Content containing excessive profanity may be subject to age restriction, content deletion, or a warning. When deciding whether to apply age restriction, delete content, or issue a warning, YouTube considers factors such as:\n- Whether sexually vulgar language or descriptions are used\n- Whether excessive profanity is used in the content\n- Whether excessive profanity or obscene terms are used in the content's title, thumbnail, or associated metadata\n- Whether excessive sexual sounds are used\n[NOTE: The English version of answer/10072685 was unavailable during fetch; this section is sourced from the translated Korean version of the page and reflects the policy substance accurately.]",
    },
    {
      title: "Age-Restricted Content",
      content:
        "Examples of content that may be age-restricted:\n- Videos focused exclusively on the use of profanity (such as compilations, songs, or clips taken out of context with no additional context provided)\n- Videos with heavy profanity in the title\n- Videos that repeatedly use vulgar or sexual language\n\nThis policy applies to videos, video descriptions, comments, live streams, audio, and any other YouTube product or feature.",
    },
    {
      title: "EDSA Exception",
      content:
        "Vulgar language may be allowed in content when the primary purpose is educational, documentary, scientific, or artistic, and it is necessary to the content. Examples include song titles with profanity or songs that contain a lot of profanity. YouTube and viewers should be able to determine the primary purpose from the content, title, and description.\n[Source: Korean language version of answer/10072685, translated]",
    },
  ],
  prohibitedContent: [
    "Heavy/extreme profanity in video titles or thumbnails (results in no ads, may trigger age restriction or removal)",
    "Sexually vulgar language used with intent to be gratuitous",
    "Excessive profanity as the primary or sole focus of content without other context",
  ],
  ageRestrictedContent: [
    "Videos with heavy profanity throughout (especially if profanity is the focal subject)",
    "Videos with strong profanity in the title",
    "Profanity-focused compilations or clips taken out of context",
    "Videos that repeatedly use vulgar or sexual language",
  ],
  edsaExceptions: [
    "Documentary quoting real speech from criminals, court transcripts, or recordings — profanity may be acceptable in video body",
    "Music with profanity (especially in professional contexts)",
    "Stand-up comedy",
    "Artistic or educational content where profanity is contextually necessary",
    "NOTE: EDSA exception does NOT override monetization penalty for profanity in title/thumbnail",
  ],
  enforcementActions: [
    "Age restriction applied to video",
    "Content removal in cases of extreme violation",
    "Warning issued for first violation",
    "Strikes system applies for repeated violations",
    "Heavy profanity in title/thumbnail results in no-ads monetization state (separate from content removal)",
  ],
};

// ============================================================
// POLICY 6: VIOLENT CRIMINAL ORGANIZATIONS
// ============================================================

const violentCriminalOrganizations: YTPolicyEntry = {
  id: "violent-criminal-organizations",
  name: "Violent Extremist or Criminal Organizations",
  category: "community_guidelines",
  sourceUrl: "https://support.google.com/youtube/answer/9229472",
  lastFetched: "2026-02-26",
  relevanceToTrueCrime: "critical",
  trueCrimeNotes:
    "True crime documentaries about organized crime (mafias, cartels, gangs), terrorism, extremist groups, or school shootings must be extremely careful not to glorify, promote, or recruit for these organizations. The policy explicitly prohibits glorifying violent tragedies such as school shootings. Documentary content about these groups IS allowed with sufficient educational context in the video itself. Covering a terrorist attack journalistically is different from celebrating it.",
  sections: [
    {
      title: "Overview",
      content:
        "Content intended to praise, promote, or aid violent extremist or criminal organizations is not allowed on YouTube. These organizations are not allowed to use YouTube for any purpose, including recruitment. In some cases, we may make exceptions for content with educational, documentary, scientific or artistic context, including content that is in the public's interest.\n\nYouTube relies on many factors, including government and international organization designations, to determine what constitutes criminal or terrorist organizations. For example, we terminate any channel where we have reasonable belief that the account holder is a member of a designated terrorist organization, such as a Foreign Terrorist Organization (U.S.), or organization identified by the United Nations.",
    },
    {
      title: "Prohibited Content",
      content:
        "Don't post content on YouTube if it fits any of the descriptions noted below:\n- Content produced by violent extremist, criminal, or terrorist organizations\n- Content praising or memorializing prominent terrorist, extremist, or criminal figures in order to encourage others to carry out acts of violence\n- Content praising or justifying violent acts carried out by violent extremist, criminal, or terrorist organizations\n- Content aimed at recruiting new members to violent extremist, criminal, or terrorist organizations\n- Content depicting hostages or posted with the intent to solicit, threaten, or intimidate on behalf of a criminal, extremist, or terrorist organization\n- Content that depicts the insignia, logos, or symbols of violent extremist, criminal, or terrorist organizations in order to praise or promote them\n- Content that glorifies or promotes violent tragedies, such as school shootings",
    },
    {
      title: "EDSA Exception",
      content:
        "If posting content related to terrorism or crime for an educational, documentary, scientific, or artistic purpose, be mindful to provide enough information in the video or audio itself so viewers understand the context. Graphic or controversial footage with sufficient context may be subject to age-restrictions or a warning screen. We may also make exceptions for content that is in the public's interest, such as congressional or parliamentary proceedings, campaign speeches, or debates over ongoing government actions. This is not a pass to praise, promote, or aid violent extremist or criminal organizations.",
    },
    {
      title: "Examples of Prohibited Content",
      content:
        "Here are some examples of content that's not allowed on YouTube:\n- Raw and unmodified reuploads of content created by terrorist, criminal, or extremist organizations\n- Celebrating terrorist leaders or their crimes in songs or memorials\n- Celebrating terrorist or criminal organizations in songs or memorials\n- Content directing users to sites that espouse terrorist ideology, are used to disseminate prohibited content, or are used for recruitment\n- Footage filmed by the perpetrator during a deadly or major violent event, in which weapons, violence, or injured victims are visible or audible\n- Links to external sites that contain manifestos of violent attackers\n- Video game content which has been developed or modified (\"modded\") to glorify a violent event, its perpetrators, or support violent criminal or terrorist organizations\n- Glorifying violence against civilians\n- Fundraising for violent criminal, extremist, or terrorist organizations",
    },
  ],
  prohibitedContent: [
    "Content produced by violent extremist, criminal, or terrorist organizations",
    "Content praising or memorializing terrorist/extremist/criminal figures to encourage others to carry out violence",
    "Content praising or justifying violent acts by such organizations",
    "Recruitment content for violent extremist, criminal, or terrorist organizations",
    "Content depicting hostages to solicit, threaten, or intimidate on behalf of such organizations",
    "Displaying insignia, logos, or symbols of violent organizations in order to praise or promote them",
    "Content glorifying or promoting violent tragedies, such as school shootings",
    "Footage filmed by the perpetrator during a deadly or major violent event where weapons/violence/injured victims are visible",
    "Links to external sites containing manifestos of violent attackers",
    "Fundraising for violent criminal, extremist, or terrorist organizations",
  ],
  ageRestrictedContent: [
    "Graphic or controversial footage about violent extremist or criminal organizations that provides sufficient educational/documentary context — may receive age restriction rather than removal",
  ],
  edsaExceptions: [
    "Documentary about a criminal organization that does not glorify or promote it — must include sufficient context in video/audio",
    "Journalistic coverage of terrorist attacks (reporting on the event, not celebrating it)",
    "Educational content analyzing how criminal organizations operate, their history, or social impact",
    "Congressional/parliamentary proceedings, campaign speeches, debates over government actions",
    "Content depicting group insignia in educational context to identify/explain, not to praise/promote",
    "Documentary about organized crime (mafias, cartels, gangs) with clear critical/journalistic framing",
  ],
  enforcementActions: [
    "Content removal and email notification",
    "Channel termination for members of designated terrorist organizations",
    "Monetization disabled on any accounts in violation",
    "First violation: Warning with option for policy training",
    "Strikes system applies (1 week → 2 weeks → channel termination)",
    "Severe abuse may result in immediate channel termination without standard strikes process",
  ],
};

// ============================================================
// POLICY 7: SUICIDE, SELF-HARM, AND EATING DISORDERS
// ============================================================

const suicideSelfHarm: YTPolicyEntry = {
  id: "suicide-self-harm-eating-disorders",
  name: "Suicide, Self-Harm, and Eating Disorders",
  category: "community_guidelines",
  sourceUrl: "https://support.google.com/youtube/answer/2802245",
  lastFetched: "2026-02-26",
  relevanceToTrueCrime: "high",
  trueCrimeNotes:
    "Some true crime cases involve perpetrator or victim suicide, self-harm, or cases where mental health disorders intersect with crime. Scripts must follow safe messaging guidelines: avoid specifying methods, avoid graphic depictions, avoid romanticizing. Documentary/educational context is recognized but graphic imagery of self-harm still requires blurring. Content about suicide is appropriate with context; suicide rescue footage and notes require sufficient context.",
  sections: [
    {
      title: "Overview",
      content:
        "At YouTube, we take the health and well-being of all our creators and viewers seriously. Awareness and understanding of mental health is important and we support creators sharing their stories, such as posting content discussing their experiences with depression, self-harm, eating disorders, or other mental health issues.\n\nHowever, we do not allow content on YouTube that promotes suicide, self-harm, or eating disorders, that is intended to shock or disgust, or that poses a considerable risk to viewers.",
    },
    {
      title: "Prohibited Content — What NOT to Post",
      content:
        "Don't post the following content:\n- Content promoting or glorifying suicide, self-harm, or eating disorders\n- Instructions on how to die by suicide, engage in self-harm, or engage in eating disorders (including how to conceal them)\n- Content related to suicide, self-harm, or eating disorders that is targeted at minors\n- Graphic images of self-harm\n- Visuals of bodies of suicide victims unless blurred or covered so they are fully obscured\n- Videos showing the lead-up to a suicide, or suicide attempts and suicide rescue footage without sufficient context\n- Content showing participation in or instructions for suicide and self-harm challenges (e.g. Blue Whale or Momo challenges)\n- Suicide notes or letters without sufficient context\n- Content that features weight-based bullying in the context of eating disorders",
    },
    {
      title: "Age-Restriction / Restriction Criteria (Instead of Removal)",
      content:
        "In some cases we may restrict, rather than remove, suicide, self-harm, or eating disorder content if it meets one or more of the following criteria:\n- Content that is meant to be educational, documentary, scientific, or artistic\n- Content that is of public interest\n- Graphic content that is sufficiently blurred\n- Dramatizations or scripted content, which includes but is not limited to animations, video games, music videos, and clips from movies and shows\n- Detailed discussion of suicide or self-harm methods, locations and hotspots\n- Graphic descriptions of self-harm or suicide\n- Eating disorder recovery content that includes details which may be triggering to at-risk viewers",
    },
    {
      title: "Best Practices for Creators",
      content:
        "We recommend using these best practices in content related to suicide or self-harm to protect your viewers from harm and distress:\n- Avoid showing the person who died by suicide, and respect their, and their families', privacy.\n- Use wording that is positive and supportive, and focuses on recovery, prevention, and stories of hope.\n- Include information and resources for suicide and self-harm prevention and coping strategies. Try to include it in both the video itself and the description of the video.\n- Do not use sensationalist language or dramatic visuals.\n- Provide context, but avoid discussing how the victim died by suicide. Do not mention the methods or locations.\n- Blur content that contains images of suicide victims. You can blur your video with the Editor in YouTube Studio.\n\nFor eating disorders:\n- Focus on the impact of the disorder instead of the details of the disordered eating behavior.\n- Tell your audience that eating disorders commonly cause severe complications.\n- Include info and resources for eating disorder prevention and coping strategies.",
    },
    {
      title: "YouTube Warning Features",
      content:
        "YouTube may show features or resources to users when content contains suicide or self-harm topics. For example:\n- A warning on your video before it starts playing, indicating that it contains content relating to suicide and self-harm\n- A panel under the video containing supportive resources such as phone numbers of suicide prevention organizations",
    },
  ],
  prohibitedContent: [
    "Content promoting or glorifying suicide, self-harm, or eating disorders",
    "Instructions on how to die by suicide, engage in self-harm, or engage in eating disorders",
    "Suicide/self-harm content targeted at minors",
    "Graphic images of self-harm (without blurring)",
    "Visuals of bodies of suicide victims unless fully blurred/obscured",
    "Lead-up to a suicide, suicide attempts, or suicide rescue footage without sufficient context",
    "Content showing or instructing participation in suicide/self-harm challenges (Blue Whale, Momo)",
    "Suicide notes or letters without sufficient context",
    "Weight-based bullying in the context of eating disorders",
  ],
  ageRestrictedContent: [
    "Educational, documentary, scientific, or artistic content about suicide/self-harm topics",
    "Graphic content that is sufficiently blurred",
    "Dramatizations or scripted content (animations, video games, movie clips) depicting these themes",
    "Detailed discussion of self-harm methods or locations",
    "Eating disorder recovery content with potentially triggering details",
  ],
  edsaExceptions: [
    "Documentary covering a case where the perpetrator or victim died by suicide — with safe messaging guidelines followed",
    "Educational content about suicide or mental health that focuses on prevention",
    "Public interest reporting on self-harm trends or eating disorder research",
    "Dramatized depictions of self-harm with appropriate blurring and context",
    "NOTE: Even EDSA content should follow safe messaging guidelines and blur graphic imagery",
  ],
  enforcementActions: [
    "Content removal and email notification",
    "Warning issued for first violation",
    "Strikes system applies for repeat violations",
    "Live streaming restrictions may be imposed if creator signals they will live stream violating content",
    "YouTube may add crisis resource panels or warnings to content even when not removed",
  ],
};

// ============================================================
// POLICY 8: PRIVACY AND IDENTITY PROTECTION
// ============================================================

const privacyIdentityProtection: YTPolicyEntry = {
  id: "privacy-identity-protection",
  name: "Privacy and Identity Protection",
  category: "community_guidelines",
  sourceUrl: "https://support.google.com/youtube/answer/2801895",
  lastFetched: "2026-02-26",
  relevanceToTrueCrime: "critical",
  trueCrimeNotes:
    "True crime documentaries frequently name real people, show addresses, discuss private details, reveal information about victims and witnesses. This is one of the most legally and policy-sensitive areas. Victims (especially of sexual crimes or crimes involving minors), witnesses, and even suspects have privacy interests. Publicly available information about public officials is treated differently from private individual information. AI-generated or synthetic content depicting real people in sensitive situations also triggers removal.",
  sections: [
    {
      title: "Overview",
      content:
        "YouTube Privacy Guidelines: Protecting Your Identity\n\nWe want you to feel safe when you're on YouTube, which is why we encourage you to let us know if videos or comments on the site violate your privacy or sense of safety.\n\nIf someone posted your personal information or uploaded a video of you without your knowledge (including in private or sensitive circumstances), ask the uploader to remove the content. If you can't reach an agreement with the uploader, or if you're uncomfortable contacting them, you can follow the Privacy Complaint Process to request to have the content removed based on our Privacy Guidelines.",
    },
    {
      title: "AI-Generated or Synthetic Content",
      content:
        "Report AI-generated or other synthetic content that looks or sounds like you: If someone has used AI to alter or create content that looks or sounds like you, you can ask for it to be removed. In order to qualify for removal, the content should depict a realistic altered or synthetic version of your likeness. We will consider a variety of factors when evaluating the complaint, such as:\n- Whether the content is altered or synthetic\n- Whether the content is disclosed to viewers as altered or synthetic\n- Whether the person can be uniquely identified\n- Whether the content is realistic\n- Whether the content contains parody, satire or other public interest value\n- Whether the content features a public figure or well-known individual engaging in a sensitive behavior such as criminal activity, violence, or endorsing a product or political candidate",
    },
    {
      title: "Criteria for Removing Content",
      content:
        "Our Privacy Guidelines give a detailed explanation of our privacy complaint process. For content to be considered for removal, an individual must be uniquely identifiable and that individual, or their legal representative, must submit the complaint. When assessing if an individual is uniquely identifiable, we consider the following factors:\n- Image or voice\n- Full name\n- Financial information\n- Contact information\n- Other personally identifiable information\n\nWhen you report a privacy complaint, we consider public interest, newsworthiness, and consent as factors in our final decision, as well as whether the videos show a person's moment of death or critical injury.\n\nTo respect the privacy and memory of deceased users, we consider requests from the closest family members or legal representatives upon verification of the individual's death.",
    },
    {
      title: "Privacy Protection Tips",
      content:
        "Tips on how to protect your privacy on YouTube:\n- Think carefully before you post personal information. This includes examples such as the town you live in, where you go to school, and your home address.\n- Protect your account data and don't share your password with others.\n- Get permission first. Get permission before filming other people or posting their personal information.\n- Visit our Privacy and Safety Settings page for a list of tools that you can use to manage your content and experience on the site.",
    },
  ],
  prohibitedContent: [
    "Posting someone's non-public personally identifiable information without consent (home address, phone number, email, financial info, medical records)",
    "Uploading videos of someone without their knowledge, especially in private or sensitive circumstances",
    "AI-generated or synthetic content realistically depicting a real person engaging in sensitive behavior (criminal activity, violence) without disclosure",
    "Content that reveals identifying information about child victims or witnesses in criminal cases",
    "Content showing a person's moment of death or critical injury (subject to privacy complaint process)",
  ],
  ageRestrictedContent: [
    "Content involving real people in sensitive situations may receive age restriction rather than removal when newsworthy/public interest",
  ],
  edsaExceptions: [
    "Public interest and newsworthiness are explicit factors in YouTube's privacy complaint evaluation",
    "Publicly available information about public officials (office phone number, public statements) is generally permitted",
    "Reporting on public figures in their public capacity is protected under news/documentary context",
    "However: Even for public figures, revealing private details (home addresses, personal medical info) that aren't publicly known may still violate privacy guidelines",
  ],
  enforcementActions: [
    "Content removal following successful privacy complaint process",
    "The person whose privacy is violated (or their legal representative) submits the complaint",
    "YouTube evaluates based on unique identifiability, public interest, newsworthiness, and consent",
    "AI-generated synthetic content depicting real people in sensitive situations subject to removal request",
    "Repeat violations may result in channel penalties under general Community Guidelines enforcement",
  ],
};

// ============================================================
// POLICY 9: CHILD SAFETY
// ============================================================

const childSafety: YTPolicyEntry = {
  id: "child-safety",
  name: "Child Safety",
  category: "community_guidelines",
  sourceUrl: "https://support.google.com/youtube/answer/2801999",
  lastFetched: "2026-02-26",
  relevanceToTrueCrime: "critical",
  trueCrimeNotes:
    "Cases involving child victims, child exploitation, child abuse, or juvenile offenders require extreme care. Cannot show, name, or identify minor victims. Cannot show actual abuse of minors even in documentary context without blurring. Cases like child abduction, trafficking of minors, or abuse cases require careful handling — journalistic reporting IS permitted but must protect minor identities and cannot be gratuitous.",
  sections: [
    {
      title: "Overview",
      content:
        "YouTube doesn't allow content that endangers the emotional and physical well-being of minors. A minor is someone under 18 years old.\n\nUpdate: Content that targets young minors and families but contains sexual themes, violence, obscenity, or other mature themes not suitable for young audiences, is not allowed on YouTube. In addition to your titles, descriptions, and tags, ensure your audience selection matches the audience your content is suitable for.\n\nIn some cases, we may make exceptions for content with educational, documentary, scientific, or artistic context, including content that is in the public's interest.",
    },
    {
      title: "Sexualization of Minors",
      content:
        "Don't post content on YouTube if it fits any of the descriptions below:\n- Sexualization of minors: Sexually explicit content featuring minors and content that sexually exploits minors including minor nudity posted with comedic intent. We report content containing child sexual abuse imagery to the National Center for Missing and Exploited Children, who work with global law enforcement agencies.",
    },
    {
      title: "Harmful or Dangerous Acts Involving Minors",
      content:
        "- Harmful or dangerous acts involving minors: Content showing a minor participating in dangerous activities or encouraging minors to do dangerous activities, particularly if someone watching could imitate the dangerous act or if the content encourages or praises the dangerous act.\n- Inflicting or advocating for the infliction of physical, sexual or emotional maltreatment or neglect of a child, including inflicting emotional distress on minors.\n  - Content that contains infliction of physical, sexual, or emotional abuse of a child within an educational, documentary, scientific, or artistic context and with blurring may receive an exception.\n  - Content that could cause minor participants or viewers emotional distress, including: Exposing minors to mature themes, Simulating parental abuse, Coercing minors, Violence.",
    },
    {
      title: "Misleading Family Content",
      content:
        "- Content that targets young minors and families, but contains: Sexual themes, Violence, Obscenity or other mature themes not suitable for young audiences, Medical procedures, Self harm, Use of adult horror characters, Other inappropriate themes intended to shock young audiences.\n- Family friendly cartoons that target young minors and contain adult or age-inappropriate themes such as violence, sex, death, drugs, and more.",
    },
    {
      title: "Cyberbullying and Harassment Involving Minors",
      content:
        "Content that:\n- Intends to shame, deceive or insult a minor\n- Reveals personal information like email addresses or bank account numbers\n- Contains sexualization\n- Encourages others to bully or harass",
    },
    {
      title: "Age-Restricted Content",
      content:
        "We may add an age restriction to content that includes any of the following:\n- Harmful or dangerous acts that adults or minors could imitate: Content containing adults participating in dangerous activities that adults or minors could easily imitate.\n- Adult themes in family content: Content meant for adult audiences but could easily be confused with family content.\n- Vulgar language: Some language is not appropriate for younger audiences. Content using sexually explicit language or excessive profanity may lead to age restriction.",
    },
    {
      title: "Content Featuring Minors — Feature Restrictions",
      content:
        "To protect minors on YouTube, content that doesn't violate our policies but depicts children or is uploaded by minors may have some features disabled at both the channel and content level. These features may include: Comments, Live chat, Live streaming, Video recommendations (how and when your video is recommended), Posts, Shorts Video remixing.\n\nLive streams with minors under 16 who are not visibly accompanied by an adult may be removed or have their live chat disabled.",
    },
    {
      title: "Examples of Prohibited Content",
      content:
        "Here are some examples of content not allowed on YouTube:\n- Videos or posts featuring minors involved in provocative, sexual, or sexually suggestive activities, challenges and dares.\n- Showing minors involved in dangerous activities. For example, physical stunts, using weapons or explosives, or using a controlled substance like alcohol or nicotine.\n- Offering money, praise, likes, or any other incentive to a minor to participate in physical contact with someone else.\n- A video or post that advertises sexual content featuring minors or abusive content featuring minors.\n- Predatory behavior involving communications with or about minors.\n- Fight or bullying content featuring kids without educational, documentary, scientific or artistic context and blurring.\n- Content simulating parental abuse or abandonment, simulating exposure to death or violence, or causing minors intense shame or humiliation.",
    },
  ],
  prohibitedContent: [
    "Any sexually explicit content featuring minors (CSAM — reported to NCMEC immediately)",
    "Minor nudity posted with comedic intent",
    "Content showing minors participating in dangerous activities (stunts, weapons use, controlled substances, fireworks)",
    "Inflicting or advocating physical, sexual, or emotional maltreatment of children",
    "Content identifying child victims of crimes, abuse, or exploitation",
    "Content targeting young audiences but containing sexual themes, violence, obscenity, or mature themes",
    "Cyberbullying of minors",
    "Predatory behavior involving communications with or about minors",
    "Fight or bullying content featuring kids without EDSA context and blurring",
  ],
  ageRestrictedContent: [
    "Content with adults doing dangerous activities that minors could imitate",
    "Adult-themed content that could be confused with family content",
    "Documentary content showing physical/emotional abuse of child within EDSA context WITH blurring applied",
  ],
  edsaExceptions: [
    "Journalistic reporting on cases involving child victims — minors' identities must be protected",
    "Educational documentary about child abuse, trafficking, or exploitation with appropriate blurring and context",
    "Content showing infliction of abuse of a child within EDSA context IF content is blurred — 'may receive an exception'",
    "Public interest reporting on child safety legislation or policy",
  ],
  enforcementActions: [
    "Content removal and email notification",
    "CSAM (child sexual abuse material) reported to NCMEC and global law enforcement immediately",
    "Zero tolerance for predatory behavior — law enforcement assisted with investigation",
    "Channel termination for severe violations",
    "Strikes system applies for less severe violations",
    "Feature restrictions (comments, live chat, recommendations) on channels with minor-focused content",
  ],
};

// ============================================================
// POLICY 10: HARMFUL OR DANGEROUS CONTENT
// ============================================================

const harmfulDangerousContent: YTPolicyEntry = {
  id: "harmful-dangerous-content",
  name: "Harmful or Dangerous Content",
  category: "community_guidelines",
  sourceUrl: "https://support.google.com/youtube/answer/2801964",
  lastFetched: "2026-02-26",
  relevanceToTrueCrime: "high",
  trueCrimeNotes:
    "True crime scripts should never provide actionable how-to information for committing crimes. Discussing a bombing case is fine; explaining exactly how a specific bomb was constructed is not. Covering hacking crimes is fine; providing step-by-step hacking instructions is not. The line is between reporting on dangerous acts (allowed) and instructing how to replicate them (prohibited). News/documentary showing the impact of dangerous activities is allowed with context.",
  sections: [
    {
      title: "Overview",
      content:
        "YouTube doesn't allow content that encourages dangerous or illegal activities that risk serious physical harm or death. In some cases, we may make exceptions for content with educational, documentary, scientific, or artistic context, including content that is in the public's interest.",
    },
    {
      title: "Harmful or Dangerous Acts, Challenges, and Pranks",
      content:
        "This content isn't allowed on YouTube:\n- Extremely dangerous challenges: Challenges that pose an imminent risk of physical injury.\n- Dangerous or threatening pranks: Pranks that lead victims to fear imminent serious physical danger, or that create serious emotional distress in minors or vulnerable individuals.\n- Harmful or dangerous acts: Acts performed by adults that have a risk of serious harm or death.\n- Minors participating in dangerous activities: Content that endangers the emotional and physical well-being of minors.",
    },
    {
      title: "Weapons Content",
      content:
        "- Instructions to kill or harm: Instructions that show or tell viewers how to perform activities that are meant to kill or severely harm others.\n- Explosives: Giving instructions to make explosive devices or compounds meant to injure or kill others.\n- Firearms: For more info, review our Firearms policy.",
    },
    {
      title: "Digital Security Content",
      content:
        "- Instructional theft: Instructional theft videos posted with the express intent to steal physical goods or get something for free.\n- Hacking: Demonstrating how to use computers or information technology with the intent to steal credentials, compromise personal data, or cause serious harm to others.\n- Bypassing payment for digital content or services: Content that shows viewers how to get unauthorized access to content, software, or services that usually require payment.\n- Phishing: Content that tries to get or gives instructions for how to get nonpublic personal identifying information from viewers by deceiving them.\n- Cryptophishing: Requests for cryptocurrency or cryptocurrency-related wallet details as a part of a phishing scheme.",
    },
    {
      title: "Examples of Extremely Dangerous Challenges",
      content:
        "- Asphyxiation: Any activity that prevents breathing or can lead to suffocation. Examples include: Choking, drowning, or hanging games; Eating non-food items.\n- Misuse of weapons: Using weapons, like guns or knives, without proper safety precautions or in a way that could cause physical harm.\n- Ingesting harmful substances: Eating, consuming, or inserting non-food objects or chemicals that may cause illness or poisoning. Examples include detergent-eating challenges.\n- Burning, freezing, and electrocution: Activities with a serious risk of severe burns, freezing, frostbite, or electrocution. Examples include the fire challenge and the hot water challenge.\n- Mutilation and blunt force trauma: Examples include: Self-mutilation; Abstaining from normal health practices; Falling, impalement, collision, blunt force trauma, or crushing.",
    },
    {
      title: "Bomb-Making and Instructions to Harm",
      content:
        "- Bomb-making: Showing viewers how to build a bomb meant to injure or kill others. Examples include: Pipe bombs; Package bombs; Explosive vests; Molotov cocktails.\n- Violence involving children: Any real fights or violence between children.",
    },
    {
      title: "Age-Restricted Content",
      content:
        "Sometimes content doesn't violate our policies, but it may not be appropriate for viewers under 18. We may restrict rather than remove if content showing a dangerous act meets one or more of the following criteria:\n- There is educational, documentary, scientific, or artistic context, such as providing information about the risks of the act.\n- The act shown does not risk serious injury.\n- The content does not promote the act shown. Promotion includes any form of encouragement or praise of the act, or providing instructions on how to complete the act.\n\nNote: Saying, 'Don't try this at home' is not sufficient context.",
    },
    {
      title: "EDSA Examples",
      content:
        "Examples of allowed EDSA content:\n- A news piece on the dangers of choking games may be appropriate, but posting clips out of context from the same documentary might not be.\n- A video in which a professional stunt person performs a dangerous motorcycle jump that shows viewers the safety precautions taken in preparation.\n- A documentary that shows the impact of drug use in a particular community that, while showing viewers drug usage, discourages viewers from using drugs and doesn't provide information on how to make or purchase them.\n- A video that shows dangerous driving or vehicle crashes in controlled environments to educate viewers about safe driving practices or vehicle safety features.",
    },
  ],
  prohibitedContent: [
    "Instructions showing or telling viewers how to perform activities meant to kill or severely harm others",
    "Instructions to make explosive devices or compounds meant to injure or kill (pipe bombs, package bombs, explosive vests, Molotov cocktails)",
    "Demonstrating how to use computers/IT to steal credentials, compromise personal data, or cause serious harm (hacking)",
    "Extremely dangerous challenges (asphyxiation, ingesting harmful substances, electrocution, self-mutilation)",
    "Dangerous pranks causing victims to fear imminent serious physical danger",
    "Phishing: instructions for obtaining non-public personal identifying information through deception",
    "Bypassing payment for digital content or services (piracy tutorials)",
    "Content showing real fights or violence between children",
  ],
  ageRestrictedContent: [
    "Content showing dangerous acts by adults with educational/documentary context (where act does not risk serious injury and content does not promote it)",
    "Prank content featuring adults using excessive fake blood or gruesome fake injuries",
    "Footage of people engaging in a dangerous challenge, with commentary describing injuries",
    "Content showing adults misusing fireworks",
    "Content showing adults using tasers on willing participants",
  ],
  edsaExceptions: [
    "News piece on dangers of a dangerous activity is allowed (reporting on it vs. instructing how to do it)",
    "Documentary showing impact of drug use in a community — allowed if it discourages drug use and doesn't provide instructions",
    "Professional stunt footage with clear safety precautions shown",
    "Congressional/parliamentary proceedings, campaign speeches",
    "True crime documentary covering a bombing — discussing that a bomb was used is different from providing bomb-making instructions",
    "Covering hacking crimes in documentary context is different from providing hacking tutorials",
  ],
  enforcementActions: [
    "Content removal and email notification",
    "First violation: Warning with option for policy training",
    "Strikes system applies (1 week → 2 weeks → channel termination)",
    "Single case of severe abuse may result in immediate channel termination",
  ],
};

// ============================================================
// POLICY 11: FIREARMS
// ============================================================

const firearmsPolicy: YTPolicyEntry = {
  id: "firearms",
  name: "Firearms Policy",
  category: "community_guidelines",
  sourceUrl: "https://support.google.com/youtube/answer/7667605",
  lastFetched: "2026-02-26",
  relevanceToTrueCrime: "high",
  trueCrimeNotes:
    "True crime documentaries frequently discuss firearms used in crimes. Discussing what type of weapon was used, the ballistics of a crime, how a firearm was illegally obtained — all acceptable in documentary context. What is NOT allowed: providing manufacturing/modification instructions, facilitating sales of illegal modifications. Covering a school shooting or mass shooting that involved specific firearms does not mean providing manufacturing instructions for those weapons.",
  sections: [
    {
      title: "Overview",
      content:
        "Content intended to sell firearms, instruct viewers on how to make firearms, ammunition, and certain accessories, or instruct viewers on how to install those accessories is not allowed on YouTube. YouTube shouldn't be used as a platform to sell firearms or accessories noted below. YouTube also doesn't allow live streams that show someone holding, handling, or transporting a firearm.\n\nSometimes content doesn't violate our policies, but it may not be appropriate for viewers under 18. YouTube age restricts content showing the use of certain firearms and accessories also noted below (note: this restriction applies to real use of firearms only).",
    },
    {
      title: "Prohibited Content",
      content:
        "Don't post content on YouTube if the purpose is to do one or more of the following:\n- Sell firearms or certain firearms accessories through direct sales (e.g. private sales by individuals) or links to sites that sell these items. These accessories may include: Accessories that enable a firearm to simulate automatic fire; Accessories that convert a firearm to automatic fire, such as: bump stocks, gatling triggers, drop-in auto sears, or conversion kits; High capacity magazines or belts carrying more than 30 rounds.\n- Provide instructions on manufacturing any of the following: Firearms; Ammunition; High capacity magazines; Homemade silencers/suppressors; Accessories that enable a firearm to simulate automatic fire; Accessories that convert a firearm to automatic fire.\n- Provide instructions on how to convert a firearm to automatic or simulated automatic firing capabilities.\n- Provide instructions on how to install the above-mentioned accessories or modifications.\n- Provide instructions on how to remove certain firearm safety devices, such as a device that limits the release of a magazine.\n- Live streams that feature someone holding or handling a firearm, regardless of whether or not they are firing it.\n- Live streams that feature someone transporting firearms from place to place.",
    },
    {
      title: "Age-Restricted Content",
      content:
        "Content showing use of a homemade firearm (e.g. 3D printed gun), an automatic firearm, or any of the below accessories:\n- Accessories that enable a firearm to simulate automatic fire\n- Accessories that convert a firearm to automatic fire, such as: bump stocks, gatling triggers, drop-in auto sears, or conversion kits\n- High capacity magazines\n- Homemade silencers/suppressors\n\nExamples (non-exhaustive):\n- Firing a 3D printed firearm\n- Firing a fully automatic rifle\n- Firing a firearm with a high capacity magazine\n\nThese guidelines apply to real use of firearms and may not apply, for example, to use of firearms in artistic content such as a film.",
    },
    {
      title: "EDSA Exception",
      content:
        "Sometimes, content that would otherwise violate this policy is allowed to stay on YouTube when it has Educational, Documentary, Scientific, or Artistic (EDSA) context. We may also make exceptions for content that is in the public's interest, such as congressional or parliamentary proceedings, campaign speeches, debates over ongoing government actions, military or police footage, news footage, or footage from warzones. This is not a pass to promote content intended to sell firearms, instruct viewers on how to make or modify firearms, ammunition, and certain accessories, or instruct viewers on how to install those accessories.",
    },
    {
      title: "Examples of Prohibited Content",
      content:
        "Here are some examples of content that isn't allowed on YouTube:\n- Links in the title or description of your video to sites where firearms or the accessories noted above are sold.\n- Displaying a firearm with the intention to sell that firearm via private sale.\n- Showing users step-by-step instructions on how to finish a lower receiver in order to complete fabrication of a firearm.\n- Showing users how to make a silencer out of a flashlight, oil can, solvent catcher or other parts.\n- Showing users how to install a bump stock, or install a comparable accessory built to enable simulated automatic fire.\n- Live streams that feature someone holding or handling a firearm, regardless of whether or not they are firing it.\n- Live streams that feature someone transporting firearms from place to place.",
    },
  ],
  prohibitedContent: [
    "Selling firearms or restricted accessories (bump stocks, high-capacity magazines >30 rounds) via direct sales or links",
    "Instructions on manufacturing firearms, ammunition, high-capacity magazines, or homemade suppressors",
    "Instructions on converting a firearm to automatic fire",
    "Instructions on installing automatic-fire conversion accessories",
    "Instructions on removing firearm safety devices",
    "Live streams showing someone holding, handling, or transporting a firearm",
  ],
  ageRestrictedContent: [
    "Content showing use of homemade/3D-printed firearms",
    "Content showing use of automatic firearms",
    "Content showing use of bump stocks, drop-in auto sears, or other automatic-conversion accessories",
    "Content showing firearms with high-capacity magazines attached",
    "Content showing use of homemade silencers/suppressors",
  ],
  edsaExceptions: [
    "Documentary discussing what type of firearm was used in a crime — context, not instructions",
    "News footage, military or police footage",
    "Congressional/parliamentary proceedings on gun legislation",
    "Footage from warzones",
    "Artistic content (films) featuring firearms — EDSA exception applies to real use guidelines",
    "True crime coverage of crimes involving specific firearms is allowed when not providing manufacturing/modification instructions",
  ],
  enforcementActions: [
    "Content removal and email notification",
    "First violation: Warning with option for policy training",
    "Strikes system applies (1 week → 2 weeks → channel termination)",
    "Single case of severe abuse may result in immediate channel termination",
  ],
};

// ============================================================
// POLICY 12: SALE OF ILLEGAL OR REGULATED GOODS
// ============================================================

const illegalRegulatedGoods: YTPolicyEntry = {
  id: "illegal-regulated-goods",
  name: "Illegal or Regulated Goods or Services",
  category: "community_guidelines",
  sourceUrl: "https://support.google.com/youtube/answer/9229611",
  lastFetched: "2026-02-26",
  relevanceToTrueCrime: "medium",
  trueCrimeNotes:
    "True crime documentaries about drug trafficking, organized crime, trafficking, or the dark web must not facilitate access to illegal goods or provide actionable guidance for acquiring them. Discussing the drug trade in a documentary (including showing drug use) is generally allowed with EDSA context, but providing links or contact info for purchasing drugs will result in channel termination.",
  sections: [
    {
      title: "Overview",
      content:
        "Content intended to sell certain regulated goods and services is not allowed on YouTube. In some cases, we may make exceptions for content with educational, documentary, scientific, or artistic context, including content that is in the public's interest.",
    },
    {
      title: "Prohibited Regulated Goods and Services",
      content:
        "Don't post content on YouTube if it aims to directly sell, link to, or facilitate access to any of the regulated goods and services listed below. Making the sale of these items or facilitating the use of these services possible by posting links, email, phone number or other means to contact a provider directly is not allowed:\n- Alcohol\n- Bank account passwords, stolen credit cards, or other financial information\n- Counterfeit documents or currency\n- Controlled narcotics and other drugs\n- Explosives\n- Organs\n- Endangered species or parts of endangered species\n- Firearms and certain firearms accessories\n- Nicotine, including vaping products\n- Uncertified online gambling sites\n- Pharmaceuticals without a prescription\n- Non-regulated substances for the purpose of abuse\n- Sex or escort services\n- Unlicensed medical services\n- Human smuggling\n\nNote: If you're providing links or contact information such as phone numbers, emails, or other means of contact where hard drugs or certain poisonous substances can be purchased, or where pharmaceuticals can be purchased without a prescription, your channel may be terminated.",
    },
    {
      title: "Additional Prohibited Content",
      content:
        "Additionally, the following content isn't allowed on YouTube:\n- Hard drug use or creation: Hard drug use or creation, selling or facilitating the sale of hard or soft drugs, facilitating the sale of regulated pharmaceuticals without a prescription, or showing how to use steroids in non-educational content.\n- Poison sale or creation: Facilitating the sale, giveaway, creation or modification of certain poisons or poisonous substances.\n- Instructional cheating: Content which provides instructions for academic cheating.",
    },
    {
      title: "Hard Drugs List",
      content:
        "Selling hard drugs: Featuring hard drugs with the goal of selling them. Some types of hard drugs include (note that this is not a complete list, and these substances may also be known under different names):\n- Amphetamine\n- Cocaine\n- Dextromethorphan (DXM)\n- Flunitrazepam\n- Fentanyl\n- GHB\n- Heroin\n- Ketamine\n- K2\n- LSD\n- MDMA/ecstasy\n- Mescaline\n- Methamphetamine\n- Isotonitazene (ISO)\n- Opium\n- PCP\n- Psilocybin & Psilocybe (magic mushrooms)\n\nSelling inhalants: Facilitating the sale of unregulated substances for abuse:\n- Hydrocarbons\n- Nitrites\n- Nitrous oxide\n\nSale of certain poisonous substances. Some examples include:\n- Cyanide\n- Chloroform\n- Mercury",
    },
    {
      title: "Examples of Prohibited Content",
      content:
        "Here are some examples of content that's not allowed on YouTube:\n- Facilitating access to an online gambling or sports betting site that is not certified.\n- Promising the viewer guaranteed returns via online gambling.\n- Selling counterfeit passports or providing instructions on creating forged official documents.\n- Advertising escort, prostitution, or erotic massage services.\n- Content instructing how to purchase drugs on the dark web.\n- A video of a user making a purchase with software that generates fake credit card numbers.\n- Including a link to an online pharmacy that does not require prescriptions.\n- Content that promotes a product that contains drugs, nicotine, or a controlled substance.\n- Displays of hard drug use: Non-educational content that shows the injection of intravenous drugs like heroin, snorting powdered drugs like cocaine, or taking hallucinogens like acid.\n- Making hard drugs: Non-educational content that explains how to make drugs.\n- Selling soft drugs: Such as providing links to sites facilitating sale of marijuana or salvia.",
    },
    {
      title: "Age-Restricted Content",
      content:
        "Sometimes content doesn't violate our policies, but it may not be appropriate for viewers under 18. Examples of age-restricted content:\n- Content that promotes a cannabis dispensary.\n- Content that reviews brands of nicotine e-liquid.\n- Content that facilitates access to, promotes, or depicts online gambling, and social/sweepstakes casinos, including content from certified sites.",
    },
    {
      title: "EDSA Exception",
      content:
        "Sometimes, content that would otherwise violate this policy is allowed to stay on YouTube when it has Educational, Documentary, Scientific, or Artistic (EDSA) context. We may also make exceptions for content that is in the public's interest, such as congressional or parliamentary proceedings, campaign speeches, or debates over ongoing government actions. This is not a pass to promote content intended to sell, create, or facilitate access to certain regulated goods and services.\n\nNote: In some cases, EDSA content may be age-restricted. Certain content isn't allowed on YouTube even if it has EDSA context added, such as content that sells drugs or regulated pharmaceuticals without a prescription.",
    },
  ],
  prohibitedContent: [
    "Directly selling or linking to sellers of controlled narcotics, firearms, counterfeit documents, explosives, organs, endangered species, nicotine products, uncertified gambling sites, pharmaceuticals without prescription, sex services, human smuggling",
    "Providing contact information (phone/email/links) where hard drugs or poisonous substances can be purchased — results in channel termination",
    "Non-educational display of hard drug use (injection of heroin, snorting cocaine, taking hallucinogens)",
    "Non-educational content explaining how to make drugs",
    "Instructions for academic cheating",
    "Facilitating the creation or sale of poisonous substances (cyanide, chloroform, mercury)",
    "Content instructing how to purchase drugs on the dark web",
    "Advertising escort, prostitution, or erotic massage services",
    "Creating counterfeit passports or official documents",
  ],
  ageRestrictedContent: [
    "Content promoting a cannabis dispensary",
    "Content reviewing nicotine e-liquid brands",
    "Content facilitating access to, promoting, or depicting online gambling including from certified sites",
  ],
  edsaExceptions: [
    "Documentary showing drug use in a community with educational/journalistic framing (e.g., showing impact of heroin epidemic)",
    "True crime documentary about drug trafficking organizations — can discuss the trade without facilitating access",
    "Documentary about human trafficking that does not provide actionable trafficking routes or contact info",
    "Congressional/parliamentary proceedings about drug policy",
    "IMPORTANT: EDSA exception does NOT apply to content that actually sells drugs or provides purchasing information",
  ],
  enforcementActions: [
    "Content removal and email notification",
    "Providing links/contact info for hard drugs or poisonous substances: Channel may be terminated immediately",
    "First violation: Warning with option for policy training",
    "Strikes system applies for repeat violations",
    "Channel termination for severe violations",
  ],
};

// ============================================================
// POLICY 13: THUMBNAILS
// ============================================================

const thumbnailsPolicy: YTPolicyEntry = {
  id: "thumbnails",
  name: "Thumbnails Policy",
  category: "community_guidelines",
  sourceUrl: "https://support.google.com/youtube/answer/9229980",
  lastFetched: "2026-02-26",
  relevanceToTrueCrime: "high",
  trueCrimeNotes:
    "True crime thumbnails often use crime scene imagery, mugshots, dramatic text, or graphic imagery to attract clicks. The same content rules that apply to videos apply to thumbnails. Gratuitously violent or gory thumbnails, even if the video itself is acceptable, can trigger age restriction or removal. A documentary-appropriate thumbnail with contextual framing (e.g., news-style presentation) is different from a shock-value thumbnail featuring gore.",
  sections: [
    {
      title: "Overview",
      content:
        "Thumbnails and other images that violate our Community Guidelines aren't allowed on YouTube. Images include banners, avatars, posts, and any other YouTube feature that has images. In some cases, we may make exceptions for content with educational, documentary, scientific, or artistic context, including content that is in the public's interest.",
    },
    {
      title: "Prohibited Thumbnail Content",
      content:
        "Don't post a thumbnail or other image on YouTube if it shows:\n- Pornographic imagery\n- Sexual acts, the use of sex toys, fetishes, or other sexually gratifying imagery\n- Nudity, including genitals\n- Imagery that depicts unwanted sexualization\n- Violent imagery that intends to shock or disgust\n- Graphic or disturbing imagery with blood or gore\n- Vulgar or lewd language\n- A thumbnail that misleads viewers to think they're about to view something that's not in the video\n\nNote: The above list isn't complete.",
    },
    {
      title: "Age-Restricted Thumbnails and Thumbnail Removal",
      content:
        "Sometimes, a thumbnail may not be appropriate for all audiences, but it doesn't violate our Community Guidelines. When that happens, we may age-restrict the video, or we may remove the thumbnail, but we don't issue a strike on your channel. If we remove a thumbnail, we let you know, and you can upload another thumbnail.\n\nHere's what we consider when we remove or age-restrict these kinds of thumbnails:\n- Whether breasts, buttocks, or genitals are the focal point of the thumbnail\n- Whether the subject is depicted in a pose or clothing that is intended to sexually arouse the viewer\n- Whether violent or gory imagery is the focal point of the thumbnail\n- Whether written text is intended to be vulgar or shock or disgust viewers\n- Whether the title, description, tags, or other data indicate an intent to shock or disgust viewers",
    },
    {
      title: "Monetization Impact of Thumbnails",
      content:
        "[Sourced from Advertiser-Friendly Content Guidelines, answer/6162278]\n\nThumbnails directly affect monetization:\n- Strong profanity (f*ck) in thumbnail: No ad revenue\n- Moderate profanity (shit) in thumbnail: Limited or no ad revenue\n- Graphic violent content in thumbnail: Limited or no ad revenue (escalating to no ads)\n- Sexual content in thumbnail: Limited or no ad revenue (escalating to no ads)\n- Misleading thumbnail (promises content not in video): Violates spam/deception policies\n- Thumbnails with shocking imagery (graphic dead bodies, gore): No ad revenue",
    },
    {
      title: "Enforcement",
      content:
        "If your thumbnail contains pornography, we may terminate your channel. If your thumbnail violates other policies, we remove the thumbnail and may issue a strike against your account. If it's the first time you've posted content that violates our Community Guidelines, you'll likely get a warning with no penalty to your channel. You will have the option to take a policy training to allow the warning to expire after 90 days. However, if one of your thumbnails violates the same policy within that 90 day window, the warning may not expire and your channel may be given a strike. If you violate a different policy after completing the training, you will get another warning.\n\nIf you get three strikes in 90 days or your channel is dedicated to violative content, your channel may be terminated.",
    },
  ],
  prohibitedContent: [
    "Pornographic or sexually gratifying imagery in thumbnails",
    "Graphic violence or gore in thumbnails intended to shock without documentary context",
    "Graphic blood, open wounds, or dismemberment in thumbnails",
    "Vulgar language or strong profanity in thumbnails",
    "Misleading thumbnails that promise content not in the video",
    "Thumbnails dehumanizing or sexually exploiting identifiable individuals",
    "Thumbnails depicting unwanted sexualization of identifiable individuals",
  ],
  ageRestrictedContent: [
    "Heavy profanity in thumbnail",
    "Graphic violent or gory imagery in thumbnail (even with context, may result in age restriction or limited ads)",
    "Focal point on graphic content in thumbnail",
    "Intent-to-shock imagery in thumbnail",
  ],
  edsaExceptions: [
    "Documentary-style thumbnails with news-presentation framing are treated more favorably than shock-value thumbnails",
    "Crime scene imagery presented in a journalistic context (e.g., news-style layout, text identifying the documentary nature) may avoid age restriction",
    "Historical images in educational framing",
    "NOTE: EDSA exception does NOT remove the monetization penalty for profanity in thumbnails",
  ],
  enforcementActions: [
    "Content may be age-restricted or removed based on thumbnail content",
    "Monetization affected: Profanity/graphic/sexual thumbnails trigger limited or no ads",
    "Thumbnail considered part of video content — thumbnail violations can result in video removal",
    "Misleading thumbnails may violate spam/deception policies separately",
  ],
};

// ============================================================
// POLICY 14: AGE-RESTRICTED CONTENT
// ============================================================

const ageRestrictedContent: YTPolicyEntry = {
  id: "age-restricted-content",
  name: "Age-Restricted Content",
  category: "content_rating",
  sourceUrl: "https://support.google.com/youtube/answer/2802167",
  lastFetched: "2026-02-26",
  relevanceToTrueCrime: "high",
  trueCrimeNotes:
    "Many true crime videos get age-restricted. Understanding what triggers age restriction (vs. removal) helps creators optimize content. Age-restricted videos can still monetize but with limited ads. Key triggers for true crime: graphic violence in survivor context, heavy profanity in title/thumbnail, graphic crime scene imagery with context, and content covering sexually violent crimes. Age restriction is the middle ground between full availability and removal.",
  sections: [
    {
      title: "Overview",
      content:
        "Sometimes content doesn't violate our Community Guidelines, but it may be incompatible with YouTube's Terms of Service or not appropriate for viewers under 18. In these cases, we may place an age-restriction on the video. This policy applies to videos, video descriptions, custom thumbnails, live streams, and any other YouTube product or feature.",
    },
    {
      title: "Types of Content Subject to Age-Restriction",
      content:
        "Below is more detail about the types of content we consider for age-restriction:\n\nChild safety:\n- A video containing adults participating in dangerous activities that minors could easily imitate, such as handling explosives or challenges that cause bodily injury\n- A video meant for adult audiences but could easily be confused with family content\nNote: Your 'made for kids' settings won't impact age restrictions on your videos.\n\nHarmful or dangerous activities, including regulated substances and drugs:\n- A video about fake harmful pranks that seems so real that viewers can't tell the difference\n- A video promoting a cannabis dispensary\n\nNudity and sexually suggestive content:\n- A video that invites sexual activity, such as provocative dancing or fondling\n- A video where the subject is in a pose that is intended to sexually arouse the viewer\n- A video where the subject is in clothing that is considered unacceptable in public contexts, such as lingerie\n\nViolent or graphic content:\n- A video with context showing survivor's injuries in a major road accident\n- A video focused on violent or gory imagery, such as focusing solely on the most graphically violent part of a film or video game\n\nVulgar language:\n- A video with heavy profanity in the title, thumbnail or associated metadata\n- A video focused on the use of profanities such as a compilation or clips taken out of context",
    },
    {
      title: "What Happens to Age-Restricted Content",
      content:
        "- Age-restricted videos are not viewable to users who are under 18 years of age or signed out.\n- Age-restricted videos cannot be watched on most third-party websites. If a video on another website has an age restriction, the viewer will be taken to YouTube. To watch it, they'll need to sign in and be over 18.\n- If you believe we made a mistake, you can appeal the age-restriction.\n- Age-restricted videos can use ads to monetize. Some advertisers prefer to advertise on family-friendly content or content without the themes noted above. In this case, your video may have limited or no ads monetization. If your channel is eligible for ads, make sure you review our advertiser-friendly content guidelines.",
    },
    {
      title: "Checking if Content is Age-Restricted",
      content:
        "You can check if your content is age-restricted by going to YouTube Studio and using the 'Age-Restriction' filter, or by looking for \"Age-restriction\" in the Restrictions column on your Videos page. Our systems are constantly being updated and if we find any discrepancies with your rating, there's a chance it could change.\n\nViewers who are over 18 and are signed in can tell whether a video is age restricted by looking below the description.",
    },
  ],
  prohibitedContent: [
    "N/A — Age restriction is an intermediate enforcement action, not removal. Content that meets age-restriction criteria is restricted, not prohibited.",
  ],
  ageRestrictedContent: [
    "Adults participating in dangerous activities that minors could easily imitate",
    "Content meant for adults that could be confused with family content",
    "Sexually suggestive content (provocative poses, lingerie, fondling)",
    "Violent or graphic content with survivor context (e.g., road accident survivor showing injuries)",
    "Videos focused on violent or gory imagery from films or games",
    "Heavy profanity in title, thumbnail, or associated metadata",
    "Profanity compilations or clips taken out of context",
    "Cannabis dispensary promotion",
  ],
  edsaExceptions: [
    "Age-restriction is itself a form of EDSA accommodation — content that would otherwise be removed gets age-restricted when educational/documentary context is present",
    "Appealing age-restriction decisions is possible if creator believes the restriction is applied in error",
  ],
  enforcementActions: [
    "Age restriction applied: Video not viewable to users under 18 or signed-out users",
    "Age-restricted videos cannot be embedded on most third-party websites",
    "Monetization impact: Limited or no ads (advertisers may opt out of age-restricted content)",
    "Creator can appeal age-restriction decisions",
  ],
};

// ============================================================
// POLICY 15: MISINFORMATION
// ============================================================

const misinformationPolicy: YTPolicyEntry = {
  id: "misinformation",
  name: "Misinformation Policies",
  category: "community_guidelines",
  sourceUrl: "https://support.google.com/youtube/answer/10834785",
  lastFetched: "2026-02-26",
  relevanceToTrueCrime: "high",
  trueCrimeNotes:
    "True crime documentaries must not present manipulated evidence, false timelines, misattributed footage (e.g., presenting old surveillance footage as from the crime in question), or fabricated claims about cases. The policy specifically prohibits doctored content that misleads users and misattributed content where old footage is falsely claimed to be from a current event. Presenting a false narrative as factual is a direct policy violation. Condemning or disputing misinformation (including about a case) is explicitly protected.",
  sections: [
    {
      title: "Overview",
      content:
        "Certain types of misleading or deceptive content with serious risk of egregious harm are not allowed on YouTube. This includes certain types of misinformation that can cause real-world harm, certain types of technically manipulated content, or content interfering with democratic processes. In some cases, we may make exceptions for content with educational, documentary, scientific, or artistic context, including content that is in the public's interest.",
    },
    {
      title: "What This Policy Prohibits",
      content:
        "Don't post content on YouTube if it fits any of the descriptions below:\n- Suppression of census participation: Content aiming to mislead census participants about the time, place, means, or eligibility requirements of the census, or false claims that could materially discourage census participation.\n- Manipulated content: Content that has been technically manipulated or doctored in a way that misleads users (usually beyond clips taken out of context) and may pose a serious risk of egregious harm.\n- Misattributed content: Content that may pose a serious risk of egregious harm by falsely claiming that old footage from a past event is from a current event.",
    },
    {
      title: "Examples of Prohibited Content",
      content:
        "Manipulated content:\n- Inaccurately translated video subtitles that inflame geopolitical tensions creating serious risk of egregious harm.\n- Videos that have been technically manipulated (usually beyond clips taken out of context) to make it appear that a government official is dead.\n- Video content that has been technically manipulated (usually beyond clips taken out of context) to fabricate events where there's a serious risk of egregious harm.\n\nMisattributed content:\n- Content inaccurately presented as documenting human rights abuses in a specific location that is actually content from another location or event.\n- Content showing a military crackdown on protesters with false claims that the content is from a current event, when the footage is actually several years old.",
    },
    {
      title: "EDSA Exception",
      content:
        "We may allow content that violates the misinformation policies noted on this page if that content includes additional context in the video, audio, title, or description. We may also make exceptions for content that is in the public's interest, such as congressional or parliamentary proceedings, campaign speeches, or debates over ongoing government actions. This is not a pass to promote misinformation. We may make exceptions if the purpose of the content is to condemn, dispute, or satirize misinformation that violates our policies.\n\nWe also allow personal expressions of opinion on the above topics as long as they don't otherwise violate any of the policies outlined above.",
    },
  ],
  prohibitedContent: [
    "Technically manipulated or doctored content that misleads users with serious risk of egregious harm",
    "Misattributed content — falsely claiming old footage from a past event is from a current event",
    "Suppression of census participation through false information",
    "Presenting fabricated events as real where there is serious risk of harm",
    "Inaccurate translation of video subtitles that inflame tensions",
    "False claims that a government official is dead via manipulated video",
  ],
  ageRestrictedContent: [
    "N/A — Misinformation policy generally results in removal or allowance with context, not age restriction",
  ],
  edsaExceptions: [
    "Content condemning, disputing, or satirizing misinformation is explicitly protected",
    "Personal expressions of opinion are allowed",
    "Congressional/parliamentary proceedings, campaign speeches",
    "Documentary re-examining a case (providing context in video/audio/title/description) is allowed",
    "Analyzing false claims made in a criminal case (e.g., debunking false alibis) is permitted",
  ],
  enforcementActions: [
    "Content removal and email notification",
    "URL removal if link safety cannot be verified",
    "First violation: Warning with option for policy training",
    "Strikes system applies for repeat violations",
    "Three strikes within 90 days: Channel termination",
  ],
};

// ============================================================
// POLICY 16: SPAM, DECEPTIVE PRACTICES, AND SCAMS
// ============================================================

const spamDeceptivePractices: YTPolicyEntry = {
  id: "spam-deceptive-practices",
  name: "Spam, Deceptive Practices, and Scams",
  category: "community_guidelines",
  sourceUrl: "https://support.google.com/youtube/answer/2801973",
  lastFetched: "2026-02-26",
  relevanceToTrueCrime: "medium",
  trueCrimeNotes:
    "True crime creators must ensure their titles and thumbnails accurately represent the video content. Clickbait titles promising exclusive evidence, new confessions, or shocking revelations that are not in the video violate the misleading metadata policy. Also relevant: don't use true crime case names/keywords in unrelated video descriptions to drive traffic.",
  sections: [
    {
      title: "Overview",
      content:
        "YouTube doesn't allow spam, scams, or other deceptive practices that take advantage of the YouTube community. We also don't allow content where the main purpose is to trick others into leaving YouTube for another site.",
    },
    {
      title: "Prohibited Deceptive Practices",
      content:
        "Don't post content on YouTube if it fits any of the descriptions noted below:\n- Video Spam: Content that is excessively posted, repetitive, or untargeted and does one or more of the following: Promises viewers they'll see something but instead directs them off site; Gets clicks, views, or traffic off YouTube by promising viewers that they'll make money fast; Sends audiences to sites that spread harmful software, try to gather personal info, or other sites that have a negative impact.\n- Misleading Metadata or Thumbnails: Using the title, thumbnails, or description to trick users into believing the content is something it is not. This includes titles, thumbnails, or descriptions leading viewers to believe they will see something in a video, but then not including it in the video content itself.\n- Scams: Content offering cash gifts, \"get rich quick\" schemes, or pyramid schemes.\n- Incentivization Spam: Content that sells engagement metrics such as views, likes, comments, or any other metric on YouTube.\n- Comments Spam: Comments where the sole purpose is to gather personal info from viewers, misleadingly drive viewers off YouTube.\n- 3rd party content: Live streams that include unauthorized 3rd party content.",
    },
    {
      title: "Misleading Metadata and Thumbnails",
      content:
        "The following types of content are not allowed on YouTube:\n- A thumbnail with a picture of a popular celebrity that has nothing to do with the video content.\n- Using the title, thumbnail, or description to lead a viewer to think they will see a genre of content that is not actually contained in the video. For example, leading a viewer to think they will see an analysis from a well-known news anchor, but the video contains a music video instead.\n- Titles, thumbnails, or descriptions leading viewers to believe they will see something in a video, but then not including it in the video content itself.\n- Using the title, thumbnail, or description to indicate a newsworthy event recently took place or is taking place, but then not addressing that event in the video content.",
    },
    {
      title: "Enforcement Specifics",
      content:
        "If your content violates this policy, we may suspend your monetization or terminate your channel or account. Learn more about monetization policies and channel or account terminations.\n\nFor some violations, we may remove the content and issue a warning or a strike against your channel. You can take an optional policy training to allow the warning to expire after 90 days. However, if your content violates the same policy within that 90 day window, the warning may not expire and your channel may be given a strike.",
    },
  ],
  prohibitedContent: [
    "Misleading titles, thumbnails, or descriptions that promise content not actually in the video",
    "Using a newsworthy event or case name in the title/description but not addressing it in the video",
    "Using popular case names or keywords in descriptions of unrelated content to drive traffic",
    "Video spam: repetitive, untargeted content",
    "Scams: cash gifts, get-rich-quick schemes, pyramid schemes",
    "Incentivization spam: selling engagement metrics (views, likes, subscribers)",
    "Comment spam: driving viewers off YouTube through deceptive comments",
  ],
  ageRestrictedContent: [],
  edsaExceptions: [
    "Reporting on a newsworthy event with appropriate disclosure that it is ongoing/developing is acceptable",
    "Educational/documentary content that uses common case names or terminology that are accurate to the video content is fine",
  ],
  enforcementActions: [
    "Content removal and email notification",
    "Monetization suspension or termination",
    "Warning for first violation (with optional policy training)",
    "Strikes system applies for repeat violations",
    "Channel or account termination for severe or repeated violations",
  ],
};

// ============================================================
// POLICY 17: IMPERSONATION
// ============================================================

const impersonationPolicy: YTPolicyEntry = {
  id: "impersonation",
  name: "Impersonation Policy",
  category: "community_guidelines",
  sourceUrl: "https://support.google.com/youtube/answer/2801947",
  lastFetched: "2026-02-26",
  relevanceToTrueCrime: "low",
  trueCrimeNotes:
    "Generally not directly relevant to true crime documentary content creation unless impersonating law enforcement, officials involved in a case, or impersonating victim/perpetrator channels. Fan channels re-enacting cases must clearly identify themselves as not the official source.",
  sections: [
    {
      title: "Overview",
      content:
        "Content intended to impersonate a person or channel is not allowed on YouTube. YouTube also enforces trademark holder rights. When a channel, or content in the channel, causes confusion about the source of goods and services advertised, it may not be allowed.",
    },
    {
      title: "Prohibited Impersonation",
      content:
        "Don't post content on YouTube if it fits any of the descriptions noted below:\n- Channel impersonation: A channel that copies another channel's profile, background, or overall look and feel in such a way that makes it look like someone else's channel. The channel does not have to be 100% identical, as long as the intent is clear to copy the other channel.\n- Personal impersonation: Content intended to look like someone else is posting it.\n\nIf you operate a fan channel, make sure you state so explicitly in your channel name or handle. It should be obvious to your viewers that your channel doesn't represent the original creator, artist or entity your channel is celebrating.",
    },
    {
      title: "Examples of Prohibited Content",
      content:
        "Here are some examples of content that's not allowed on YouTube:\n- Channels with the same identifier (channel name or handle) and image as another channel, with the only difference being a space inserted into the name or a zero replacing the letter O.\n- Using someone else's real name, user name, image, brand, logo, or other personal information to trick people into believing you are that person.\n- Setting up a channel using the same identifier (channel name or handle) and image of a person, and then pretending that person is posting content to the channel.\n- Setting up a channel using the name and image of a person, and then posting comments on other channels as if they were posted by the person.\n- Channels claiming to be a 'fan account' in the channel description, but not stating so clearly in the channel name or handle, or posing as another's channel and reuploading their content.\n- Channels impersonating an existing news channel.",
    },
  ],
  prohibitedContent: [
    "Channels copying another channel's profile, background, or look to impersonate it",
    "Content intended to look like it's being posted by someone else",
    "Using someone's real name, image, brand, or logo to impersonate them",
    "Fan channels that don't clearly identify themselves as fan channels in the channel name/handle",
    "Impersonating existing news channels",
  ],
  ageRestrictedContent: [],
  edsaExceptions: [
    "Fan channels and commentary channels are allowed if they clearly identify themselves as such in the channel name or handle",
    "Satire/parody of public figures is allowed when clearly identified as such",
  ],
  enforcementActions: [
    "Channel or account may be terminated (no standard strike process — channel termination is the primary consequence)",
    "Trademark violations handled separately through trademark complaint process",
  ],
};

// ============================================================
// POLICY 18: COMMUNITY GUIDELINES OVERVIEW
// ============================================================

const communityGuidelinesOverview: YTPolicyEntry = {
  id: "community-guidelines-overview",
  name: "Community Guidelines Overview",
  category: "community_guidelines",
  sourceUrl: "https://support.google.com/youtube/answer/9288567",
  lastFetched: "2026-02-26",
  relevanceToTrueCrime: "high",
  trueCrimeNotes:
    "The master index of all YouTube policies. Important to know the categories: Spam & Deceptive Practices, Sensitive Content, Violent/Dangerous Content, Regulated Goods, and Misinformation. The EDSA exception principle applies across all categories. Creator behavior on and off platform can affect enforcement.",
  sections: [
    {
      title: "Introduction",
      content:
        "When you use YouTube, you join a community of people from all over the world. The guidelines below help keep YouTube fun and enjoyable for everyone.\n\nSometimes, content that would otherwise violate our Community Guidelines may stay on YouTube when it has Educational, Documentary, Scientific, or Artistic (EDSA) context, including content that is in the public's interest. In these cases, the content gets an EDSA exception.\n\nThese policies apply to all types of content on our platform, including, for example, unlisted and private content, comments, links, posts, and thumbnails. This list isn't complete.",
    },
    {
      title: "Spam & Deceptive Practices",
      content:
        "The YouTube Community is one that's built on trust. Content that intends to scam, mislead, spam, or defraud other users isn't allowed on YouTube.\n- Spam, deceptive practices, & scams policies\n- Impersonation policy\n- External links policy\n- Fake engagement policy\n- Playlists policy\n- Additional policies",
    },
    {
      title: "Sensitive Content",
      content:
        "We hope to protect viewers, creators, and especially minors. That's why we've got rules around keeping children safe, sex & nudity, and self harm. Learn what's allowed on YouTube and what to do if you see content that doesn't follow these policies.\n- Nudity & sexual content policies\n- Thumbnails policy\n- Child safety policy\n- Suicide, self-harm, and eating disorders policy\n- Vulgar language policy",
    },
    {
      title: "Violent or Dangerous Content",
      content:
        "Hate speech, predatory behavior, graphic violence, malicious attacks, and content that promotes harmful or dangerous behavior isn't allowed on YouTube.\n- Harmful or dangerous content policies\n- Violent or graphic content policies\n- Violent criminal organizations policy\n- Hate speech policy\n- Harassment & cyberbullying policies",
    },
    {
      title: "Regulated Goods",
      content:
        "Certain goods can't be sold on YouTube. Find out what's allowed and what isn't.\n- Sale of illegal or regulated goods or services policies\n- Firearms policy",
    },
    {
      title: "Misinformation",
      content:
        "Certain types of misleading or deceptive content with serious risk of egregious harm are not allowed on YouTube. This includes certain types of misinformation that can cause real-world harm, like promoting harmful remedies or treatments, certain types of technically manipulated content, or content interfering with democratic processes.\n- Misinformation policies\n- Elections misinformation policies\n- Medical misinformation policies",
    },
    {
      title: "EDSA Content",
      content:
        "Our Community Guidelines aim to make YouTube a safer community. Sometimes, content that would otherwise violate our Community Guidelines may stay on YouTube when it has Educational, Documentary, Scientific, or Artistic (EDSA) context. We may also make exceptions for content that is in the public's interest, such as congressional or parliamentary proceedings, campaign speeches, or debates over ongoing government actions. In these cases, the content gets an EDSA exception. This is not a pass to violate our Community Guidelines.",
    },
    {
      title: "Creator Behavior Note",
      content:
        "Please take these rules seriously. If a YouTube creator's on- and/or off-platform behavior harms our users, community, employees or ecosystem, we may respond based on a number of factors including, but not limited to, the egregiousness of their actions and whether a pattern of harmful behavior exists. Our response will range from suspending a creator's privileges to account termination.",
    },
  ],
  prohibitedContent: [
    "All content prohibited by the specific Community Guidelines policies listed in this overview",
    "Note: These policies apply to ALL content types including unlisted/private videos, comments, links, posts, and thumbnails",
  ],
  ageRestrictedContent: [
    "Content that falls within the age-restriction criteria of any of the specific policies",
  ],
  edsaExceptions: [
    "EDSA exception applies across all Community Guidelines categories",
    "Public interest content (congressional/parliamentary proceedings, campaign speeches, debates on government actions) generally receives exceptions",
    "Context must appear in the content itself (video/audio) — title/description context is insufficient for most policy categories",
  ],
  enforcementActions: [
    "Off-platform behavior by creators can also trigger enforcement",
    "Full strikes system applies",
    "Channel or account termination for severe violations",
    "Repeated pattern of harmful behavior may lead to escalated enforcement",
  ],
};

// ============================================================
// POLICY 19: STRIKES SYSTEM
// ============================================================

const strikesSystem: YTPolicyEntry = {
  id: "strikes-system",
  name: "Community Guidelines Strikes System",
  category: "enforcement",
  sourceUrl: "https://support.google.com/youtube/answer/12950271",
  lastFetched: "2026-02-26",
  relevanceToTrueCrime: "high",
  trueCrimeNotes:
    "Understanding the strikes system is essential for any creator making true crime content. Over 86% of creators with a Community Guidelines violation only get a warning. Strikes expire after 90 days. Policy training is available to expire warnings early. The system provides meaningful recourse before channel termination.",
  sections: [
    {
      title: "Overview",
      content:
        "Anyone who uses YouTube must follow the Community Guidelines. These global rules help make sure YouTube is the best place to listen, share, and create community. They outline the types of content that are allowed on YouTube and the rules prohibiting things like spam and harassment, and much more.\n\nYouTube relies on a combination of people and technology to report inappropriate content, which helps us enforce these guidelines across the platform.\n\nIf we find your content doesn't follow our Community Guidelines, you'll typically only receive a warning for the first violation.",
    },
    {
      title: "Warning",
      content:
        "To have this warning expire after 90 days, you can take a policy training. However, if your content violates the same policy within that 90 day window, the warning will not expire and your channel will be given a strike. If you violate a different policy after completing the training, you will get another warning.\n\nRepeated violations of our policies – or a single case of severe abuse – may still result in the termination of your account. We may prevent repeat offenders from taking trainings in the future.",
    },
    {
      title: "Strike Escalation",
      content:
        "After the warning:\n- The next time your content is found to violate our policies, you'll get a Community Guidelines strike. You won't be able to post anything - videos, live streams, stories, custom thumbnails, or posts - for 1 week. This strike expires in 90 days.\n- If you get a second strike within 90 days of your first strike, you won't be able to post anything - videos, live streams, stories, custom thumbnails or posts - for two [more] weeks.\n- If you get three strikes in the same 90 days, your channel will be terminated.\n- Sometimes a single case of severe abuse will result in channel termination without warning. If you think we made a mistake, you can appeal the warning.",
    },
    {
      title: "Things to Keep in Mind",
      content:
        "- Community Guidelines apply to everything you do on YouTube. Remember them when creating videos, thumbnails, leaving comments, etc.\n- If you upload content that violates Community Guidelines, you will get an email to let you know. We'll also give you info on how to appeal in case a mistake was made.\n- Over 86% of creators with a Community Guidelines violation only get a warning. Don't be afraid to interact - these guidelines are here to help keep YouTube fun and enjoyable for everyone.\n- To post content on YouTube, it's important to follow the Community Guidelines and Copyright laws. If you want to monetize on YouTube, you must follow YouTube channel monetization policies and Advertiser-friendly content guidelines.",
    },
  ],
  prohibitedContent: [],
  ageRestrictedContent: [],
  edsaExceptions: [],
  enforcementActions: [
    "First violation: Warning — no posting restrictions (option to take policy training to expire warning after 90 days)",
    "Violation of same policy within 90-day window after training: Warning does not expire, channel receives a strike",
    "First strike: 1-week posting ban (videos, live streams, stories, thumbnails, posts). Strike expires in 90 days.",
    "Second strike within 90 days of first: 2-week additional posting ban",
    "Third strike within 90 days: Channel termination",
    "Single case of severe abuse: Immediate channel termination without standard warning process",
    "Creators can appeal warnings and strikes if they believe a mistake was made",
    "Over 86% of creators with a violation only receive a warning — channel termination is rare",
    "Repeat offenders may be prevented from taking future policy trainings",
  ],
};

// ============================================================
// POLICY 20: ADVERTISER-FRIENDLY CONTENT GUIDELINES
// ============================================================

const advertiserFriendlyOverview: YTPolicyEntry = {
  id: "advertiser-friendly-content-guidelines",
  name: "Advertiser-Friendly Content Guidelines",
  category: "advertiser_friendly",
  sourceUrl: "https://support.google.com/youtube/answer/6162278",
  lastFetched: "2026-02-26",
  relevanceToTrueCrime: "critical",
  trueCrimeNotes:
    "This is THE key policy for monetization. Even content that passes Community Guidelines and is not age-restricted may still receive limited or no ads based on advertiser-friendliness. True crime content most commonly triggers: Violence (graphic real-world violence / crime scenes), Shocking content (graphic dead bodies, crime scene photos), Inappropriate language (profanity in quotes), Recreational drugs (when covering drug-related crime), Controversial issues (child abuse cases, sexual assault cases), Firearms (when covering gun violence). Self-certification in YouTube Studio is required and affects monetization status.",
  sections: [
    {
      title: "Overview",
      content:
        "If you're in the YouTube Partner Program, you can share revenue from ads. This article aims to help you understand which individual videos or Shorts on your channel are suitable for advertisers. Creators can use this article to understand both the platform's self-certification questionnaire and specific rules about what may earn ad revenue, may earn limited or no ad revenue and what will earn no ad revenue. Our policies apply to all portions of your content (video, Short, or live stream, thumbnail, title, description, and tags).\n\nAll content uploaded to YouTube must comply with both our Community Guidelines and our Program Policies. If your content violates our Community Guidelines, it may be removed from YouTube.\n\nPlease note that context is very important. Artistic content such as music videos may contain elements such as inappropriate language, references to soft drug use, or non-explicit sexual themes, and still be suitable for advertising.",
    },
    {
      title: "The 14 Advertiser-Friendly Content Categories",
      content:
        "The following are the main categories assessed for advertiser-friendliness:\n1. Inappropriate language\n2. Violence\n3. Adult content\n4. Shocking content\n5. Harmful acts and unreliable content\n6. Hateful & derogatory content\n7. Recreational drugs and drug-related content\n8. Firearms-related content\n9. Controversial issues\n10. Sensitive events\n11. Enabling dishonest behavior\n12. Inappropriate content for kids and families\n13. Incendiary and demeaning\n14. Tobacco-related content\n\nEach category has three tiers: full ads, limited/no ads, and no ads.",
    },
    {
      title: "Self-Certification",
      content:
        "Creators are required to self-certify their content using the questionnaire in YouTube Studio. Accurate self-certification is important — inaccurate certification can result in monetization penalties. YouTube's automated systems review content and may adjust monetization status. Creators can request human review of automated decisions.",
    },
  ],
  prohibitedContent: [
    "See MONETIZATION_GUIDELINES for detailed per-category prohibitions",
    "Note: Advertiser-Friendly Guidelines govern monetization, not content removal — violations result in limited/no ads, not necessarily content removal",
  ],
  ageRestrictedContent: [
    "Age-restricted content can still be monetized but with limited ads since many advertisers opt out of age-restricted content",
  ],
  edsaExceptions: [
    "Educational, documentary, and journalistic context generally moves content from 'no ads' to 'limited ads' tier",
    "Context is critical: same content with documentary framing may earn more than without",
  ],
  enforcementActions: [
    "Inaccurate self-certification: Monetization penalty — may lose monetization on the video or across channel",
    "Automated monetization review: YouTube systems may flag content for limited/no ads",
    "Creator can request human review of automated monetization decisions",
    "Repeated inaccurate certifications may result in broader monetization restrictions",
  ],
};

// ============================================================
// COMPLETE YT_POLICIES ARRAY
// ============================================================

export const YT_POLICIES: YTPolicyEntry[] = [
  violentGraphicContent,
  nuditySexualContent,
  harassmentCyberbullying,
  hateSpeech,
  vulgarLanguage,
  violentCriminalOrganizations,
  suicideSelfHarm,
  privacyIdentityProtection,
  childSafety,
  harmfulDangerousContent,
  firearmsPolicy,
  illegalRegulatedGoods,
  thumbnailsPolicy,
  ageRestrictedContent,
  misinformationPolicy,
  spamDeceptivePractices,
  impersonationPolicy,
  communityGuidelinesOverview,
  strikesSystem,
  advertiserFriendlyOverview,
];

// ============================================================
// MONETIZATION GUIDELINES (14 CATEGORIES)
// Source: https://support.google.com/youtube/answer/6162278
// ============================================================

export const MONETIZATION_GUIDELINES: MonetizationCategory[] = [
  {
    category: "Inappropriate Language",
    fullAdsDescription:
      "Abbreviated or obscured profanity, or words like 'hell' or 'damn' in the title, thumbnail, or video. Moderate profanity like 'bitch', 'douchebag', 'asshole', and 'shit' used frequently in the video. Most profanity used within music or stand-up comedy video content. Definitions: 'Obscured profanity' refers to things like bleeping or muting the word as well as covering written words with black bars, symbols, or text added in post-production. 'Abbreviated profanity' refers to an acronym like WTF ('what the f*ck') where the original term is abbreviated by using its acronyms.",
    limitedAdsDescription:
      "Moderate profanity (like 'shit') in the title or thumbnail. Some examples: Focal usage of profanity throughout a video (such as profanity used in most sentences). Profanity used in the title or thumbnail of music or stand up comedy content.",
    noAdsDescription:
      "Stronger profanity (like f*ck) used in thumbnails or titles. Use of extreme profanity, which includes hateful language or slurs in the video, thumbnail, or title such as 'n***er' or 'fa**ot'. Any use of hateful language in the video.",
    trueCrimeExamples: [
      "Quoting a criminal's verbatim speech containing moderate profanity in the video body: Full ads likely OK",
      "Quoting verbatim speech with 'f*ck' in the video body (not first 8 seconds, not title): May still qualify for full ads",
      "Title like 'The F*cking Monster: True Story of [Case]': No ads",
      "Quoting strong profanity in first 8 seconds of video: Limited ads",
      "Transcribing court audio containing strong profanity throughout the narration: Limited ads risk",
      "Using slurs in any context (even quoting perpetrator's language): No ads — consider bleeping",
    ],
  },
  {
    category: "Violence",
    fullAdsDescription:
      "Law enforcement including regular duty in action (such as forcible arrest, crowd control, dispute with officer, forcible entry); unedited gameplay violence occurring after the first 15 seconds; mild violence with minimal blood; dead bodies that are fully obscured, blurred, prepared for burial, or shown in historical events like wars, as part of an educational video. Non-violent or brief references to foreign terrorist organizations (FTOs). Educational content or journalistic reporting which includes imagery related to foreign terrorist organizations or mentioning foreign terrorist organizations as the central topic. General violence includes: Dramatized content depicting non-graphic violence or graphic violence. In the course of a larger narrative, showing a fleeting scene involving physical harm as a part of a violent action scene. Reports of nearby homicide events without graphic descriptions of the casualties. Educational, dramatized, journalistic reporting or music videos containing implied moment of death or severe bodily harm.",
    limitedAdsDescription:
      "Dead bodies with obvious injury or damage in educational or documentary settings (such as a history learning channel); graphic game violence in thumbnail or early on in the content; raw footage of armed conflict without injuries; description of graphic details of tragedies; dramatized content displaying severe and shocking injuries. Comedic references or fleeting images of foreign terrorist organizations. A documentary on a recent homicide featuring descriptive language of the circumstances of death. Reporting of tragedies involving multiple casualties which include graphic or gruesome details. Highly graphic descriptions of tragedies (in the form of audio or video). Highly combative altercations with law enforcement.",
    noAdsDescription:
      "Graphic dead bodies in a non-educational video; video gameplay featuring prohibited themes (such as sexual assault). Ultra graphic violent acts (including those involving law enforcement) and injuries. Incitement to or glorification of violence. Glorification, denialism, recruitment, or graphic portrayal of foreign terrorist organizations. Any first party uploaded footage or content with foreign terrorist organizations as the main topic. Focus on blood, guts, gore, bodily fluids (human or animal), crime scenes or accident photos with little to no context. Displaying the graphic aftermath of an act of violence that includes extremely shocking imagery, including heavy display of blood or gore (such as open wounds like amputated leg or severe burns) or severe agony. Non-educational obscured (such as blurred) graphic dead bodies. Content focally depicting violence between minors in any context or featuring injury or distress to the participants.",
    trueCrimeExamples: [
      "Narrating a murder case with factual description of the crime: Full ads (no graphic imagery)",
      "Showing crime scene photos with blurring applied and journalistic context: Limited ads likely",
      "Discussing a murder case with descriptive language about injuries in documentary style: Limited ads",
      "Showing unblurred crime scene photos as central focus: No ads",
      "Coverage of a terrorist attack in journalistic framing: May qualify for full ads",
      "Showing moment of death in any context: No ads",
      "Covering gang violence or cartel crime with documentary framing: Limited ads (avoid graphic imagery as focal point)",
      "School shooting documentary with emotional survivor interviews (no graphic injury footage): Full ads likely",
    ],
  },
  {
    category: "Adult Content",
    fullAdsDescription:
      "Romance or kissing; discussions of romantic relationships or sexuality without reference to intercourse; fully obscured nudity that is indiscernible and without intent to arouse the audience; breastfeeding nudity where a child is present; non-graphic sex education; dancing involving rhythmic body movements. Romantic scenes that aren't sexually gratifying. Discussions of sex in non-sexually gratifying/comedic contexts including sex education, STDs, sexual orientation. Usage of sexual jokes and innuendos that does not use vulgar or obscene terms.",
    limitedAdsDescription:
      "Classical art displaying discernible intercourse or focus on genitals in thumbnails; non-arousing sexual education containing animated sex acts; pranks involving sexual themes; dancing with focus on minimal clothing; deliberate touching of or sustained focus on sexual body parts in dance. Sex-related content, such as documentaries about the sex industry. Educational and documentary content containing discussion of intimate sexual experiences.",
    noAdsDescription:
      "Exposed, minimally covered sexual body parts or full nudity; breastfeeding nudity without a child present in the scene; sexual acts (even if blurred or implied); discussion of sexual topics, such as fetishes, tips, experiences; a video thumbnail with sexual content; sexually arousing scenes and gestures; appearance of sex toys or devices; content related to sex industry and their workers; animal sexuality featuring genitals or mating scenes. Mentions of sexual fetishes even when not descriptive. Graphic sexual acts or simulations intended to gratify.",
    trueCrimeExamples: [
      "Documentary about a sex trafficking case with factual, non-graphic descriptions: Limited ads (sex industry context)",
      "Discussing a rape case in journalistic/documentary context without graphic descriptions: Full ads possible",
      "Documentary discussing prostitution networks as part of a crime story: Limited ads",
      "Any graphic sexual description even in documentary context: No ads risk",
      "Case involving sexual fetishes discussed clinically: No ads (fetish topic = no ads regardless of context)",
    ],
  },
  {
    category: "Shocking Content",
    fullAdsDescription:
      "Light or moderately shocking content that is obscured or shown in context for educational, documentary, or other purposes. Medical or cosmetic procedures that are educational, focusing on the procedure itself. Obscured or fleeting display of body parts, liquids, or waste during medical or cosmetic procedures. Accidents where no exposed injury is visible. Accidents that are presented in a news, documentary, or artistic context.",
    limitedAdsDescription:
      "Shocking content, like graphic images of human, or animal body parts, that is unobscured or intended to shock yet still provides general context. Focus on real body parts, liquids, or waste where the intent is to shock. Educational or artistic content with medical or cosmetic procedures focusing on exhibiting unobscured bodily parts, fluids or waste in detail. Accidents where there's a strong moment of impact. High impact car crash where no victims are shown suffering. A documentary on a recent homicide featuring descriptive language of the circumstances of death.",
    noAdsDescription:
      "Highly shocking content where the whole purpose of the video is to shock viewers. Generally, no real context is provided, while gruesome and gory elements, distress, or mishandling are clear and apparent. Disgusting, gruesome, or gory presentations of bodily parts, fluids, or waste with little to no context. Unobscured body parts, liquids, or waste taking up a large proportion of a video that are gruesome and gory even while context is provided. Upsetting presentations of accidents and extreme injuries where exposed body parts are visible. Showing bleeding and exposed tissue is visible.",
    trueCrimeExamples: [
      "Discussing autopsy findings in a murder case verbally (no graphic imagery): Full ads",
      "Showing blurred crime scene imagery with documentary narration: Limited ads",
      "Showing graphic injury or death imagery even with context, as a focal point: No ads",
      "Discussing graphic injuries from a crime in descriptive language without imagery: Limited ads risk",
      "Forensic evidence shown with clinical context but highly graphic: No ads",
    ],
  },
  {
    category: "Harmful Acts and Unreliable Content (Misinformation)",
    fullAdsDescription:
      "Stunts or acts that are slightly dangerous, but performed in a professional and controlled environment where no one is seriously injured. Activities where risk is involved with no visible injuries such as professional stunts. Educational or documentary content seeking to explain how groups promoting harmful misinformation gain traction. Educational or documentary content with a focus on debunking harmful misinformation. Neutral content about viruses, infectious diseases without the intent of inciting fear.",
    limitedAdsDescription:
      "Content showing but not focusing on physical harm or distress, including acts done in a non-professional, non-controlled environment. Educational, documentary, or news report on harmful or dangerous acts with graphic injury. Educational, documentary, or news reports on prank or challenge content with threats or advocacy for physical or psychological harm. Pranks or challenges that create extreme emotional distress.",
    noAdsDescription:
      "Content that mainly shows accidents, vigilantism, pranks, or dangerous acts, such as experiments or stunts that have health risks. Glorification of harmful or dangerous acts. Pranks or challenges that should not be imitated such as a challenge to drink chlorine and may result in immediate and critical harm to one's health. Promoting harmful health or medical claims or practices. Spreading misinformation that denies established medical and scientific facts. Making claims that are demonstrably false and could significantly undermine participation or trust in an electoral or democratic process.",
    trueCrimeExamples: [
      "Debunking false claims about a criminal case: Full ads",
      "Documentary about how misinformation spread during a high-profile trial: Full ads",
      "Presenting false evidence as factual or misattributing footage to a case: Violates misinformation policy — no ads + potential removal",
      "Discussing conspiracy theories about a case while clearly labeling them as unproven: Full ads possible",
      "Presenting conspiracy theories as fact: No ads + potential removal",
    ],
  },
  {
    category: "Hateful and Derogatory Content",
    fullAdsDescription:
      "Content referencing protected groups or criticizing an individual's opinions or actions in a non-hurtful manner. News content which describes a protected group in a non-hateful way such as a news report on discrimination. Comedic content that condemns or alludes to ridicule, humiliation, or other disparaging comments towards protected groups. Public debates on protected groups without inciting hatred and violent confrontation against them. Educational or documentary content with obscured racial slurs or derogatory terms with the intent to educate the audience. Criticizing an individual's or group's opinion, views, or actions without any incendiary or demeaning intent.",
    limitedAdsDescription:
      "Content that may be offensive to individuals or groups, but is used for education, news, or in a documentary. Debate that may include offensive language but is intended to educate such as a political debate on civil rights issues. Educational content with unobscured racial slurs or derogatory terms with the intent to educate the audience. Raw footage of someone conducting acts of focusing on shaming or insulting an individual or group without explicitly promoting or glorifying such acts.",
    noAdsDescription:
      "Hate or harassment towards individuals or groups. Statements intended to disparage a protected group or imply/state its inferiority. Non-educational content featuring racial slurs or derogatory terms. Promoting, glorifying, or condoning violence against others. Inciting discrimination against protected groups. Promoting hate groups, hate symbols, or hate group paraphernalia. Malicious shaming or insulting of an individual or group. Singling out an individual or group for abuse or harassment. Denying or glorifying that tragic events happened, framing victims or survivors as crisis actors. Malicious personal attacks, slander, and defamation.",
    trueCrimeExamples: [
      "Covering a hate crime case with educational framing that condemns the perpetrator's ideology: Full ads",
      "Discussing racial or religious motivations for crimes in documentary context: Full ads (criticizing ideology, not promoting it)",
      "Quoting perpetrator's hateful statements with editorial framing showing they are wrong: Limited ads",
      "Using unbleeped slurs from perpetrator's statements without educational framing: No ads",
      "Covering extremist ideology in documentary (condemning it): Full to limited ads depending on imagery",
    ],
  },
  {
    category: "Recreational Drugs and Drug-Related Content",
    fullAdsDescription:
      "Educational, humorous, or music-related references about recreational drugs or drug paraphernalia, where the intent is not to promote or glorify illegal drug usage. Drug deals shown in gaming content. Documentary, journalistic, or comedic content portraying usage of drugs or drug trafficking organizations. Personal accounts of drug addiction recovery. Music videos with fleeting depiction of drugs. Documentary or journalistic reports on the purchase, fabrication, usage, or distribution of drugs, such as a story about a drug bust. Dramatized, documentary, or journalistic report including gaming scenes with consumption or usage (such as injection) of drugs. Educational, dramatized, journalistic, or music content focusing on the international drug trade as a whole.",
    limitedAdsDescription:
      "Non-educational and non-informational content focusing on illegal drug consumption (including injection) or creation, where the intent is not to promote or glorify illegal drug usage. Dramatized content, including music and video games, showing recreational drug usage. Scenes of injecting drugs to get high in a scripted content. Public service announcements on DTO. Educational content focused primarily on specific DTOs or DTO leaders. May include non-graphic situations of attacks or hostage situations. Violent situations and actions such as hostages or interrogation conducted by DTOs.",
    noAdsDescription:
      "Content promoting or glorifying drug usage, such as providing instructions on buying, making, selling, or finding illegal drugs or drug paraphernalia in order to encourage recreational usage. Glorification, recruitment, graphic portrayal (e.g. hostage situation), or imagery of drug trade organizations. Focal content on drug trafficking organizations. Sharing drug reviews and drug insights. Tips or recommendations on recreational drug usage or creation, such as cannabis farming. Reviews of cannabis coffee shops, head shops, dealers, dispensary tours. Non-educational videos focused on specific DTOs, DTO leaders, or international drug trading. Non-educational depictions of DTO-related imagery such as flags, slogans, banners. Comedic content covering DTOs or international drug trading as a subject.",
    trueCrimeExamples: [
      "Documentary about a drug trafficking organization (journalistic/educational framing): Full ads likely",
      "Reporting on a drug bust or cartel crime: Full ads",
      "Detailed profile of a specific cartel or drug lord without educational framing: No ads (focal DTO content)",
      "Covering a murder case that involved drug trafficking: Full ads (drugs not the focal subject)",
      "Documentary showing drug use in community to explain crime context: Full ads (documentary with educational intent)",
      "Script describing drug manufacturing process in detail: No ads + potential policy violation",
    ],
  },
  {
    category: "Firearms-Related Content",
    fullAdsDescription:
      "Non or semi-automatic and unmodified guns shown in a safe environment like a shooting range or a clear open area so as not to endanger bystanders or property owned by others. Firearm and paintball gun assembly and disassembly for the purposes of repair or maintenance. Responsible use of airsoft or ball bullet (BB) guns. Discussions on gun legislation or the issue of gun control. Gun reviews and demonstrations. Content featuring optical scopes and silencers. Prop guns when not used to harm a person or property.",
    limitedAdsDescription:
      "Use of guns outside a controlled environment; use of airsoft or ball bullet (BB) guns against others without protective gear. Showing guns being used in unprepared or uncontrolled environments (e.g. on a public street outside a home, or anywhere bystanders or other people's property are put at risk).",
    noAdsDescription:
      "Content that shows gun creation or modification (including assembly or disassembly), promotes gun makers or sellers, or facilitates the sale of a gun, minors using guns without adult supervision. Content showing guns modified with bump stocks or hair triggers, thermal night vision or infrared sights, or using thermal, explosive, or incendiary ammunition. Content featuring large capacity magazines (more than 30 rounds) attached or separate from a gun. Content featuring fully automatic guns or guns modified to fire more than one round on a single trigger pull. Guides as to how to add bump stocks to a firearm. Recommendations of top gun manufacturers or firms from which to purchase firearms. Facilitating gun sales. Videos containing firearm-making instructions. Assembly/disassembly of a firearm for the purpose of modification.",
    trueCrimeExamples: [
      "Discussing what type of firearm was used in a mass shooting (no instructions): Full ads",
      "Documentary about gun violence or mass shootings: Full ads if no graphic imagery focal point",
      "Discussing how a perpetrator illegally obtained a firearm (no how-to): Full ads",
      "Showing a perpetrator's firearm (mentioned/shown briefly): Full ads",
      "Extended discussion of firearm modifications used in a crime with step-by-step detail: No ads + policy violation risk",
    ],
  },
  {
    category: "Controversial Issues and Sensitive Events",
    fullAdsDescription:
      "Content related to preventing controversial issues. Content where the controversial issues are mentioned fleetingly and are non-graphic and non-descriptive. Non-graphic but descriptive or dramatized content related to domestic abuse, self-harm, suicide, adult sexual abuse, abortion, and sexual harassment. Non-graphic, main topic news coverage of controversial issues. Non-graphic abortion content, including personal accounts, opinion pieces, or medical procedure content. Content that covers historical or legislative facts related to abortion. Journalistic reporting of non-graphic, non-descriptive content related to suicide/self-harm, adult sexual abuse, domestic abuse, and sexual harassment. Dramatized or artistic depictions of controversial issues. General reference to eating disorders without triggering or imitable signals. For sensitive events: Discussions involving the loss of life or tragedy that are not exploitative or dismissive. News reporting, documentary content or discussions about a sensitive event.",
    limitedAdsDescription:
      "Artistic, educational, documentary, or scientific representation of controversial issues. Non-graphic, non-descriptive, main topic related to child abuse. Thumbnails with graphic depictions of controversial issues, including real or dramatized. Depicting a child being verbally abused. Dramatized or artistic depiction of eating disorders with triggering or imitable signals. Eating disorder recovery stories.",
    noAdsDescription:
      "Graphic depictions of controversial issues. Descriptive content related to child abuse as the main topic. Graphic first person accounts or biographies from survivors discussing their past experiences with child abuse. Promotion or glorification of controversial issues in the content, title, or thumbnail. Graphic depiction of self-harm where scars, blood, or injury are visible. Creators may not monetize content that profits from or exploits a sensitive event. Using keywords related to a sensitive event to attempt to drive additional traffic.",
    trueCrimeExamples: [
      "True crime case involving domestic violence, non-graphic journalistic coverage: Full ads",
      "Documentary about sexual assault case with non-graphic, non-descriptive approach: Full ads possible",
      "Detailed survivor accounts of child abuse as central topic: No ads",
      "Covering a mass shooting in documentary style without exploiting victims: Full ads (news/documentary context)",
      "Using a mass shooting case name as a tag in unrelated video: No ads + spam policy violation",
      "Coverage of a sensitive ongoing event (war, disaster) without exploitation: Full ads (news context)",
    ],
  },
  {
    category: "Sensitive Events",
    fullAdsDescription:
      "Discussions involving the loss of life or tragedy that are not exploitative or dismissive. In certain circumstances, we may prevent monetization of any content related to a sensitive event to avoid abuse or exploitation of victims. Context is important: for instance, we may allow content to earn ad revenue if it features news reporting, documentary content or discussions about a sensitive event.\n\nNote (March 23, 2022 update): Due to the war in Ukraine, content that exploits, dismisses, or condones the war is ineligible for monetization until further notice.",
    limitedAdsDescription:
      "Content related to sensitive events that may be borderline in terms of exploitation versus legitimate reporting requires careful framing.",
    noAdsDescription:
      "Creators may not monetize content that profits from or exploits a sensitive event. Examples: Appearing to profit from a tragic event with no discernible benefit to users; sale of products or services that may not meet the standards of relevant oversight bodies; using keywords related to a sensitive event to attempt to drive additional traffic.",
    trueCrimeExamples: [
      "Documentary about a school shooting case with survivor interviews: Full ads (documentary context, not exploitative)",
      "Rapid upload about ongoing mass casualty event using keywords to drive traffic: No ads + potential removal",
      "Covering historical mass shootings in analytical/documentary context: Full ads",
      "Selling merchandise related to a tragic event: No ads + potentially violates sensitive events policy",
      "Series about terrorism cases in journalistic documentary style: Full ads if not exploitative",
    ],
  },
  {
    category: "Enabling Dishonest Behavior",
    fullAdsDescription:
      "Educational, humorous, or music-related references or statements on dishonest behavior. Content that doesn't promote dishonest behavior such as journalistic reports on misdemeanors against codes of conduct. Penetration testing (a service that ethical hackers sell to companies to test for physical and information security vulnerabilities). Bug bounties (rewards offered for finding computer bugs). Digital hacks, lifehacks, tips and tricks. Educational, documentary or journalistic reports on usage or encouragement of hacking software in competitive e-sports. Documentaries about crime. Personal accounts by individuals affected by crimes.",
    limitedAdsDescription:
      "N/A (this category primarily distinguishes between full ads and no ads)",
    noAdsDescription:
      "Content meant to educate viewers on how to gain unauthorized access or make unauthorized changes to systems, devices, or property in malicious ways. Displaying acts that are against a property's code of conduct. Showcasing products or services that help mislead or cheat, such as academic essay writing services or hacking methods to win in competitive e-sports. Promoting or glorifying trespassing. Encouraging or enabling viewers to digitally track or monitor another person or their activities without their consent. Tips on how to wiretap a person's phone without their consent. Academic essay writing services. Circumvention of drug tests. Forgery or creation of fake passports or other identification documents.",
    trueCrimeExamples: [
      "Documentary about a hacker or cybercriminal (how they operated, their impact): Full ads",
      "Journalistic report on trespassing or crime: Full ads",
      "Providing step-by-step instructions that recreate how a crime was committed: No ads + policy violation",
      "Covering identity fraud or financial crime cases: Full ads (documentary context)",
      "Instructions on how to forge documents inspired by a case: No ads + policy violation",
    ],
  },
  {
    category: "Inappropriate Content for Kids and Families",
    fullAdsDescription:
      "Content that encourages positive behavior and isn't harmful to kids. Educational content on negative behavior. Public Service Announcements (PSAs) or videos on the negative impact of bullying or humiliating kids. Videos about sports and fitness. DIYs, challenges, or pranks that have low risk and cause no serious physical or emotional harm to kids.",
    limitedAdsDescription:
      "Content that is made to appear appropriate for kids and families, but contains adult themes such as: sex and sexual innuendos, violence, realistic weapons, moderate/strong/extreme profanity, drugs and alcohol, or other depictions of kids or popular kids' characters that are unsuitable for kids and families.",
    noAdsDescription:
      "Content that could impact kids by promoting negative behavior such as cheating and bullying, or content that could cause serious physical or emotional harm to kids. Content that encourages or promotes negative behavior by kids, or content about social issues that negatively affect kids. Dishonest behavior, such as cheating on tests. Display of real or realistic guns in kids content. Binge eating high sugar or high fat foods. Bullying, harassing, or humiliating kids. DIYs or challenges that depict or could result in serious physical or emotional harm. Family friendly cartoons that target young minors and contain adult or age-inappropriate themes such as violence, sex, death, drugs.",
    trueCrimeExamples: [
      "True crime content should never be categorized as 'made for kids' — this policy is not directly relevant for adult documentary content",
      "If true crime content appears family-friendly (certain documentary styles could be confused for educational kids content), ensure audience settings are set to 'not made for kids'",
      "Cases involving child victims: Not 'kids content' — ensure audience is set appropriately and content handles minor victims with care",
    ],
  },
  {
    category: "Incendiary and Demeaning",
    fullAdsDescription:
      "Objective debate/discussion. Objective discussions and analyses of public figures and their actions. Educational or documentary content about contentious social issues. Criticism of public figures based on their actions without personal attacks.",
    limitedAdsDescription:
      "Content that focuses on shaming or insulting an individual or group. Content that may offend without being outright hateful. Borderline content that shames without educational value.",
    noAdsDescription:
      "Content that is intended to bully, harass, or humiliate. Content that focuses on shaming or insulting an individual or group. Content that singles out someone for abuse or harassment. Content that suggests a tragic event did not happen, or that victims or their families are actors, or complicit in a cover-up of the event. Malicious personal attacks, slander, and defamation.",
    trueCrimeExamples: [
      "Objective analysis of a criminal's psychology and actions: Full ads",
      "Documentary exploring systemic failures in a case (e.g., police misconduct): Full ads",
      "Content that repeatedly mocks or shames a victim's family: No ads + harassment policy risk",
      "Suggesting a documented crime was faked or victims are crisis actors: No ads + potential removal (misinformation + harassment)",
      "Personal attacks against investigators or officials beyond factual criticism: No ads risk",
    ],
  },
  {
    category: "Tobacco-Related Content",
    fullAdsDescription:
      "Anti-smoking content. Public service announcements for preventative actions. Dramatized content with focal depiction of usage in non-promotional context. Educational or documentary content showcasing industries involving vaping/tobacco.",
    limitedAdsDescription:
      "Tobacco use depicted without promotion. Product reviews of or comparison between tobacco products (e.g. vaping juice comparison). Educational or documentary mention of addiction services.",
    noAdsDescription:
      "Promoting tobacco and tobacco-related products. Promoting cigarettes, cigars, chewing tobacco. Promoting tobacco-related products: tobacco pipes, rolling papers, vape pens. Promoting products designed to simulate tobacco smoking: herbal cigarettes, e-cigarettes, vaping. Footage of minors consuming vaping/tobacco products. Facilitating the sale of vaping/tobacco products. Usage of vaping/tobacco products in a manner not intended by the manufacturer.",
    trueCrimeExamples: [
      "Covering a case where tobacco or vaping was involved (not promotional): Full ads",
      "Documentary about illegal cigarette trafficking: Full ads (educational context)",
      "Cases involving minors using tobacco or vaping: No ads if depicted focally",
      "Not typically a major concern for true crime documentary content",
    ],
  },
];

// ============================================================
// POLICY METADATA
// ============================================================

export const POLICY_METADATA: PolicyMetadata = {
  totalPolicies: YT_POLICIES.length,
  lastUpdated: "2026-02-26",
  version: "1.0.0",
  trueCrimeRelevantPolicies: YT_POLICIES.filter(
    (p) => p.relevanceToTrueCrime === "critical" || p.relevanceToTrueCrime === "high"
  ).map((p) => p.id),
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Retrieve a single policy by its slug ID.
 * Returns undefined if no policy with that ID exists.
 */
export function getPolicyById(id: string): YTPolicyEntry | undefined {
  return YT_POLICIES.find((p) => p.id === id);
}

/**
 * Return all policies at a given relevance level.
 * @param level "critical" | "high" | "medium" | "low"
 */
export function getPoliciesByRelevance(level: RelevanceLevel): YTPolicyEntry[] {
  return YT_POLICIES.filter((p) => p.relevanceToTrueCrime === level);
}

/**
 * Return all policies in a given category.
 * @param category "community_guidelines" | "advertiser_friendly" | "enforcement" | "content_rating"
 */
export function getPoliciesByCategory(category: PolicyCategory): YTPolicyEntry[] {
  return YT_POLICIES.filter((p) => p.category === category);
}

/**
 * Return the monetization category entry for a given category name.
 * Case-insensitive partial match is supported.
 */
export function getMonetizationRisk(category: string): MonetizationCategory | undefined {
  const normalizedQuery = category.toLowerCase();
  return MONETIZATION_GUIDELINES.find((m) =>
    m.category.toLowerCase().includes(normalizedQuery)
  );
}

/**
 * Build a complete formatted string of all policies suitable for embedding
 * in an LLM prompt as a policy reference document.
 *
 * This is the primary function used by the Stage 2 compliance review prompt.
 * Includes all verbatim policy text, organized by relevance for true crime content.
 *
 * @param options.relevanceFilter - If provided, only include policies at this level or more critical
 * @param options.includeMonetization - Whether to include the MONETIZATION_GUIDELINES (default: true)
 * @param options.policyIdsToInclude - If provided, only include policies with these IDs
 */
export function buildPolicyPromptContext(options?: {
  relevanceFilter?: RelevanceLevel;
  includeMonetization?: boolean;
  policyIdsToInclude?: string[];
}): string {
  const relevancePriority: Record<RelevanceLevel, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  const minPriority = options?.relevanceFilter
    ? relevancePriority[options.relevanceFilter]
    : 0;

  let policies = YT_POLICIES.filter((p) => {
    if (options?.policyIdsToInclude) {
      return options.policyIdsToInclude.includes(p.id);
    }
    return relevancePriority[p.relevanceToTrueCrime] >= minPriority;
  });

  // Sort by relevance: critical first, then high, medium, low
  policies = policies.sort(
    (a, b) =>
      relevancePriority[b.relevanceToTrueCrime] -
      relevancePriority[a.relevanceToTrueCrime]
  );

  const includeMonetization = options?.includeMonetization !== false;

  const lines: string[] = [];

  lines.push("=".repeat(80));
  lines.push("YOUTUBE POLICY REFERENCE DATABASE");
  lines.push(`Version: ${POLICY_METADATA.version} | Last Updated: ${POLICY_METADATA.lastUpdated}`);
  lines.push(`Total Policies: ${POLICY_METADATA.totalPolicies}`);
  lines.push(
    "Purpose: This document contains verbatim YouTube Community Guidelines and Monetization policies."
  );
  lines.push(
    "Use this as the authoritative reference for evaluating true crime documentary scripts."
  );
  lines.push("=".repeat(80));
  lines.push("");

  lines.push("CRITICAL POLICIES FOR TRUE CRIME DOCUMENTARY CONTENT:");
  lines.push(POLICY_METADATA.trueCrimeRelevantPolicies.join(", "));
  lines.push("");

  // Community Guidelines Policies
  lines.push("=".repeat(80));
  lines.push("SECTION 1: COMMUNITY GUIDELINES POLICIES");
  lines.push("=".repeat(80));
  lines.push("");

  for (const policy of policies) {
    lines.push("-".repeat(60));
    lines.push(`POLICY: ${policy.name.toUpperCase()}`);
    lines.push(`ID: ${policy.id}`);
    lines.push(`Category: ${policy.category}`);
    lines.push(`Source URL: ${policy.sourceUrl}`);
    lines.push(`True Crime Relevance: ${policy.relevanceToTrueCrime.toUpperCase()}`);
    lines.push(`True Crime Notes: ${policy.trueCrimeNotes}`);
    lines.push("");

    lines.push("-- FULL POLICY TEXT --");
    for (const section of policy.sections) {
      lines.push(`[${section.title}]`);
      lines.push(section.content);
      lines.push("");
    }

    if (policy.prohibitedContent.length > 0) {
      lines.push("PROHIBITED CONTENT (specific items not allowed):");
      policy.prohibitedContent.forEach((item) => lines.push(`  • ${item}`));
      lines.push("");
    }

    if (policy.ageRestrictedContent.length > 0) {
      lines.push("AGE-RESTRICTED CONTENT (restricted rather than removed):");
      policy.ageRestrictedContent.forEach((item) => lines.push(`  • ${item}`));
      lines.push("");
    }

    if (policy.edsaExceptions.length > 0) {
      lines.push("EDSA EXCEPTIONS (what's allowed with Educational/Documentary/Scientific/Artistic context):");
      policy.edsaExceptions.forEach((item) => lines.push(`  • ${item}`));
      lines.push("");
    }

    if (policy.enforcementActions.length > 0) {
      lines.push("ENFORCEMENT ACTIONS:");
      policy.enforcementActions.forEach((item) => lines.push(`  • ${item}`));
      lines.push("");
    }
  }

  if (includeMonetization) {
    lines.push("=".repeat(80));
    lines.push("SECTION 2: ADVERTISER-FRIENDLY CONTENT GUIDELINES (MONETIZATION)");
    lines.push("Source: https://support.google.com/youtube/answer/6162278");
    lines.push(
      "This section governs whether content earns FULL ADS, LIMITED/NO ADS, or NO ADS."
    );
    lines.push(
      "Note: Content can pass Community Guidelines and still receive no ads under these rules."
    );
    lines.push("=".repeat(80));
    lines.push("");

    for (const monetizationCat of MONETIZATION_GUIDELINES) {
      lines.push("-".repeat(60));
      lines.push(`MONETIZATION CATEGORY: ${monetizationCat.category.toUpperCase()}`);
      lines.push("");
      lines.push("✅ FULL ADS (Content can earn full ad revenue):");
      lines.push(monetizationCat.fullAdsDescription);
      lines.push("");
      lines.push("⚠️  LIMITED OR NO ADS (Reduced monetization):");
      lines.push(monetizationCat.limitedAdsDescription);
      lines.push("");
      lines.push("❌ NO ADS (Content will earn no ad revenue):");
      lines.push(monetizationCat.noAdsDescription);
      lines.push("");
      lines.push("TRUE CRIME SPECIFIC EXAMPLES:");
      monetizationCat.trueCrimeExamples.forEach((ex) => lines.push(`  → ${ex}`));
      lines.push("");
    }
  }

  lines.push("=".repeat(80));
  lines.push("END OF YOUTUBE POLICY REFERENCE DATABASE");
  lines.push("=".repeat(80));

  return lines.join("\n");
}
