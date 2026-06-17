import type { Citation, SectionDef } from "./types";

/* ---------- Anchor Evidence Library ----------
   Seeded, real published sources. The OJJDP Model Programs Guide CAC literature
   review is the anchor [A1]. Staff must still confirm bibliographic details
   before submission. */
export const ANCHOR_LIBRARY: Citation[] = [
  {
    id: "A1",
    authors: "Office of Juvenile Justice and Delinquency Prevention",
    year: "2021",
    title: "Children's Advocacy Centers (Model Programs Guide Literature Review)",
    source: "OJJDP Model Programs Guide, ojjdp.ojp.gov/model-programs-guide",
    finding:
      "Federal literature review summarizing the history, characteristics, and effectiveness of CACs in responding to child maltreatment; synthesizes evidence on forensic interviewing, MDT coordination, caregiver satisfaction, and investigation outcomes.",
    tags: ["CAC model", "MDT", "effectiveness", "federal anchor"],
    badge: "anchor",
  },
  {
    id: "A2",
    authors: "Cross, T. P., Jones, L. M., Walsh, W. A., Simone, M., Kolko, D. J., et al.",
    year: "2007",
    title: "Evaluating Children's Advocacy Centers' Response to Child Sexual Abuse (Multi-Site Evaluation)",
    source: "OJJDP Juvenile Justice Bulletin / Crimes against Children Research Center, UNH",
    finding:
      "Four-community quasi-experimental evaluation: CAC cases showed more coordinated investigations, greater police–child protection collaboration, more referrals to medical exams and mental health services, and higher caregiver satisfaction than comparison communities.",
    tags: ["multi-site", "MDT", "medical referral", "caregiver satisfaction"],
    badge: "anchor",
  },
  {
    id: "A3",
    authors: "Herbert, J. L., & Bromfield, L.",
    year: "2016",
    title: "Evidence for the Efficacy of the Child Advocacy Center Model: A Systematic Review",
    source: "Trauma, Violence, & Abuse, 17(3)",
    finding:
      "Systematic review finding consistent evidence that CACs improve criminal justice and child-focused process outcomes relative to standard investigation, while identifying the need for stronger outcome research.",
    tags: ["systematic review", "criminal justice outcomes"],
    badge: "anchor",
  },
  {
    id: "A4",
    authors: "Herbert, J. L., & Bromfield, L.",
    year: "2017",
    title: "Better Together? A Review of Evidence for Multi-Disciplinary Teams Responding to Physical and Sexual Child Abuse",
    source: "Trauma, Violence, & Abuse",
    finding:
      "Review of MDT evidence: co-located, formally coordinated teams are associated with reduced duplicative interviews, improved information sharing, and better case decision-making.",
    tags: ["MDT", "coordination", "interview reduction"],
    badge: "anchor",
  },
  {
    id: "A5",
    authors: "Smith, D. W., Witte, T. H., & Fricker-Elhai, A. E.",
    year: "2006",
    title: "Service Outcomes in Physical and Sexual Abuse Cases: A Comparison of Child Advocacy Center-Based and Standard Services",
    source: "Child Maltreatment, 11(4)",
    finding:
      "CAC-served families accessed more services and showed higher rates of follow-through with mental health referrals than families receiving standard, non-CAC services.",
    tags: ["service utilization", "mental health referral", "family advocacy"],
    badge: "anchor",
  },
  {
    id: "A6",
    authors: "Lippert, T., Cross, T. P., Jones, L., & Walsh, W.",
    year: "2009",
    title: "Telling Interviewers about Sexual Abuse: Predictors of Child Disclosure at Forensic Interviews",
    source: "Child Maltreatment, 14(1)",
    finding:
      "Multi-site CAC data on disclosure dynamics; supports developmentally informed, legally sound forensic interview practice as a core CAC mechanism.",
    tags: ["forensic interview", "disclosure"],
    badge: "anchor",
  },
  {
    id: "A7",
    authors: "Shadoin, A. L., Magnuson, S. N., Overman, L. B., Formby, J. P., & Shao, L.",
    year: "2006",
    title: "Cost-Benefit Analysis of Community Responses to Child Maltreatment",
    source: "National Children's Advocacy Center, Huntsville, AL",
    finding:
      "Cost-benefit analysis estimating that CAC-based investigations cost substantially less per case than traditional, non-coordinated investigations — frequently cited as ~36% lower average cost.",
    tags: ["cost-effectiveness", "ROI"],
    badge: "anchor",
  },
  {
    id: "A8",
    authors: "Cohen, J. A., Deblinger, E., Mannarino, A. P., & Steer, R. A.",
    year: "2004",
    title: "A Multisite, Randomized Controlled Trial for Children with Sexual Abuse-Related PTSD Symptoms",
    source: "Journal of the American Academy of Child & Adolescent Psychiatry, 43(4)",
    finding:
      "Landmark RCT establishing Trauma-Focused CBT as superior to child-centered therapy for PTSD, depression, and behavior problems in abused children — the evidentiary backbone for CAC-linked treatment.",
    tags: ["TF-CBT", "treatment", "RCT"],
    badge: "anchor",
  },
  {
    id: "A9",
    authors: "Felitti, V. J., Anda, R. F., Nordenberg, D., Williamson, D. F., et al.",
    year: "1998",
    title: "Relationship of Childhood Abuse and Household Dysfunction to Many of the Leading Causes of Death in Adults (The ACE Study)",
    source: "American Journal of Preventive Medicine, 14(4)",
    finding:
      "Foundational dose-response evidence linking childhood adversity to lifelong health outcomes; anchors the public-health case for early trauma screening and intervention.",
    tags: ["ACEs", "trauma screening", "public health"],
    badge: "anchor",
  },
  {
    id: "A10",
    authors: "Greenbaum, J., & Crawford-Jakubiak, J. E. (AAP Committee on Child Abuse and Neglect)",
    year: "2015",
    title: "Child Sex Trafficking and Commercial Sexual Exploitation: Health Care Needs of Victims",
    source: "Pediatrics, 135(3)",
    finding:
      "AAP clinical report on identification and health care needs of trafficked and commercially exploited youth; supports systematic screening and trauma-informed, multidisciplinary response.",
    tags: ["trafficking", "CSEC", "screening"],
    badge: "anchor",
  },
  {
    id: "A11",
    authors: "Edinburgh, L., Saewyc, E., & Levitt, C.",
    year: "2008",
    title: "Caring for Young Adolescent Sexual Abuse Victims in a Hospital-Based Children's Advocacy Center",
    source: "Child Abuse & Neglect, 32(12)",
    finding:
      "Evidence on CAC-based care for adolescent victims, including runaway and exploited youth — relevant to extending the CAC model to trafficking-involved adolescents.",
    tags: ["adolescents", "trafficking-adjacent", "CAC services"],
    badge: "anchor",
  },
];

export const SECTION_DEFS: SectionDef[] = [
  { key: "needStatement", num: "01", label: "Need Statement" },
  { key: "evidenceBase", num: "02", label: "Evidence Base" },
  { key: "interventionRationale", num: "03", label: "Intervention Rationale" },
  { key: "logicModel", num: "04", label: "Outcome Logic Model" },
  { key: "funderLanguage", num: "05", label: "Funder-Aligned Language" },
  { key: "citationPacket", num: "06", label: "Citation Packet" },
  { key: "proposalParagraphs", num: "07", label: "Proposal-Ready Paragraphs" },
  { key: "conceptNote", num: "08", label: "One-Page Concept Note" },
  { key: "federalVersion", num: "09", label: "Federal Proposal Version" },
  { key: "foundationVersion", num: "10", label: "Family Foundation Version" },
];

export const DEFAULT_REQUEST =
  "We are requesting $350,000 to expand trauma screening, family advocacy, and MDT coordination for children exposed to abuse, trafficking, or severe neglect.";
