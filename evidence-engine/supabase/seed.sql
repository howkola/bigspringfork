-- Seed data for local development / first deploy.
-- 1. Put your grants-team emails on the allowlist BEFORE they sign up.
--    (Replace these with your real team.)

insert into public.team_allowlist (email, role) values
  ('tracy@thisisthesite.com', 'admin')
on conflict (email) do nothing;

-- 2. A starter corpus so the pipeline has evidence to cite.

insert into public.corpus_entries
  (title, source_type, authors, publication, publication_year, url, summary, key_findings, tags, confidence, last_verified_at, stale_after)
values
  (
    'Children''s Advocacy Center model reduces duplicative forensic interviews',
    'peer_reviewed_study',
    'Cross, T.P.; Jones, L.M.; Walsh, W.A.; Simone, M.; Kolko, D.',
    'Child Abuse & Neglect',
    2007,
    'https://doi.org/10.1016/j.chiabu.2007.04.006',
    'Multi-site evaluation comparing CAC and non-CAC communities. Children served by CACs were substantially more likely to receive a single coordinated forensic interview and referrals to medical exams and mental-health services.',
    array[
      'CAC cases involved coordinated multidisciplinary team investigation in 81% of cases versus 52% in comparison communities.',
      'Children at CACs were twice as likely to receive forensic medical examinations.'
    ],
    array['forensic-interviews','mdt','outcomes'],
    'high',
    now(), now() + interval '18 months'
  ),
  (
    'Trauma-focused CBT outcomes for children who experienced abuse',
    'peer_reviewed_study',
    'Cohen, J.A.; Mannarino, A.P.; Deblinger, E.',
    'Journal of the American Academy of Child & Adolescent Psychiatry',
    2004,
    'https://doi.org/10.1097/00004583-200404000-00005',
    'Randomized controlled trial of trauma-focused cognitive behavioral therapy (TF-CBT) demonstrating significant reductions in PTSD, depression, and behavior problems among children who experienced sexual abuse.',
    array[
      'TF-CBT produced significantly greater improvement in PTSD symptoms than child-centered therapy.',
      'Gains were sustained at 6- and 12-month follow-up.'
    ],
    array['mental-health','tf-cbt','evidence-based-treatment'],
    'high',
    now(), now() + interval '18 months'
  ),
  (
    'Project Harmony internal outcomes report FY2025',
    'internal_program_data',
    'Project Harmony Evaluation Team',
    'Internal report',
    2025,
    null,
    'Annual service and outcome data for Project Harmony Child Advocacy Center: children served, forensic interviews conducted, mental-health referrals completed, family advocate contacts, and caregiver satisfaction.',
    array[
      'Served 1,240 children in FY2025 across forensic interview, advocacy, and therapy programs.',
      '92% of caregivers reported the center helped them understand next steps in their child''s case.',
      'Average wait time from referral to forensic interview was 3.2 business days.'
    ],
    array['internal-data','outcomes','fy2025'],
    'high',
    now(), now() + interval '12 months'
  ),
  (
    'National Children''s Alliance standards for accredited members',
    'government_report',
    'National Children''s Alliance',
    'NCA Standards for Accredited Members',
    2023,
    'https://www.nationalchildrensalliance.org/nca-standards-for-accredited-members/',
    'Accreditation standards covering the multidisciplinary team model, forensic interviewing, victim advocacy, medical evaluation, mental health, and organizational capacity for children''s advocacy centers.',
    array[
      'Accredited CACs must provide culturally responsive victim advocacy services to all children and families.',
      'Standards require documented MDT protocols signed by all partner agencies.'
    ],
    array['standards','accreditation','mdt'],
    'medium',
    now(), now() + interval '24 months'
  ),
  (
    'Adverse Childhood Experiences and long-term health (CDC-Kaiser ACE study)',
    'government_report',
    'Felitti, V.J.; Anda, R.F.; et al.',
    'American Journal of Preventive Medicine',
    1998,
    'https://doi.org/10.1016/S0749-3797(98)00017-8',
    'Landmark study linking adverse childhood experiences, including abuse, to leading causes of death and poor health outcomes in adulthood; foundational evidence for early intervention.',
    array[
      'Persons with four or more ACEs had 4- to 12-fold increased health risks for alcoholism, drug abuse, depression, and suicide attempt.',
      'Dose-response relationship between number of ACEs and adult health outcomes.'
    ],
    array['aces','prevention','public-health'],
    'high',
    -- Deliberately stale so the freshness monitor has something to flag in dev.
    now() - interval '2 years', now() - interval '6 months'
  );

-- 3. A sample grant opportunity with funder-required sections.

insert into public.grant_opportunities
  (funder, title, description, focus_areas, amount_min, amount_max, deadline, required_sections, status)
values
  (
    'Sample Family Foundation',
    'Child Wellbeing & Family Stability Initiative',
    'Supports organizations providing coordinated, trauma-informed responses to child abuse, with emphasis on measurable child and family outcomes and multidisciplinary collaboration.',
    array['child-welfare','trauma-informed-care','mental-health'],
    50000, 150000,
    (now() + interval '60 days')::date,
    '[
      {"key": "need_statement", "title": "Statement of Need", "word_limit": 750},
      {"key": "program_description", "title": "Program Description", "word_limit": 1000},
      {"key": "evidence_base", "title": "Evidence Base & Best Practices", "word_limit": 600},
      {"key": "outcomes_evaluation", "title": "Outcomes & Evaluation Plan", "word_limit": 600},
      {"key": "organizational_capacity", "title": "Organizational Capacity", "word_limit": 500}
    ]'::jsonb,
    'prospect'
  );
