/**
 * Curated content that guarantees Orbit can always be demonstrated, even when
 * external APIs are offline.
 *
 * - Jobs, events and mentors use FICTIONAL organisations and are flagged
 *   `isDemo` so the UI labels them as demo listings.
 * - Books and papers are real publications; summaries are written by Orbit.
 * - Role models are real public figures described only with widely documented,
 *   high-level career facts, with links to public sources.
 */
import type { EventType, OpportunityType, ResourceType, WorkMode } from '@orbit/shared';

export interface CuratedJob {
  id: string;
  title: string;
  company: string;
  industry: string;
  location: string;
  workMode: WorkMode;
  employmentType: OpportunityType;
  postedDaysAgo: number;
  deadlineInDays: number;
  salaryRange?: string;
  skills: string[];
  description: string;
}

export const CURATED_JOBS: CuratedJob[] = [
  {
    id: 'np-pm-intern',
    title: 'Product Management Intern',
    company: 'Nusantara Pay',
    industry: 'Fintech',
    location: 'Jakarta, Indonesia',
    workMode: 'HYBRID',
    employmentType: 'INTERNSHIP',
    postedDaysAgo: 2,
    deadlineInDays: 6,
    salaryRange: 'IDR 4–5.5M / month',
    skills: ['product analytics', 'sql', 'user research', 'communication', 'stakeholder management', 'agile'],
    description:
      'Nusantara Pay helps 3 million small merchants accept digital payments. As a Product Management Intern you will join the Merchant Growth squad for six months and own a real problem end to end.\n\nWhat you will do\n- Analyse merchant onboarding funnels and find where merchants drop off\n- Run user interviews with merchants and synthesise insights\n- Write clear product requirement documents with engineers and designers\n- Define success metrics and track them after launch\n\nWhat we look for\n- Final-year student or fresh graduate in Computer Science, Information Systems, Business or similar\n- Structured problem solving and strong communication\n- Comfortable with data: basic SQL or spreadsheets is a plus\n- Experience leading a student organisation or project is valued',
  },
  {
    id: 'kl-apm',
    title: 'Associate Product Manager',
    company: 'Kopiloka',
    industry: 'E-commerce',
    location: 'Jakarta, Indonesia',
    workMode: 'HYBRID',
    employmentType: 'FULL_TIME',
    postedDaysAgo: 5,
    deadlineInDays: 14,
    salaryRange: 'IDR 11–14M / month',
    skills: ['product strategy', 'product analytics', 'a/b testing', 'roadmap', 'stakeholder management', 'sql'],
    description:
      'Kopiloka is a coffee-commerce platform connecting 1,200 local roasters with customers across Indonesia. Our APM program is a two-year track for early-career product people.\n\nResponsibilities\n- Own the checkout experience roadmap and prioritise with RICE\n- Design and read A/B tests on conversion\n- Partner with engineering, design and operations to ship weekly\n- Present insights to leadership\n\nRequirements\n- 0–2 years of experience; internships count\n- Analytical mindset, SQL preferred\n- Excellent written and verbal communication',
  },
  {
    id: 'll-product-analyst-intern',
    title: 'Product Analyst Intern',
    company: 'Lumen Learning ID',
    industry: 'EdTech',
    location: 'Remote (Indonesia)',
    workMode: 'REMOTE',
    employmentType: 'INTERNSHIP',
    postedDaysAgo: 1,
    deadlineInDays: 10,
    skills: ['product analytics', 'sql', 'data visualization', 'statistics', 'communication'],
    description:
      'Lumen Learning ID builds adaptive learning for 400,000 high-school students. Our product analytics team turns learning data into product decisions.\n\nYou will\n- Build dashboards for retention and course completion\n- Write SQL to answer product questions from PMs\n- Help design and evaluate experiments\n- Share weekly insight memos\n\nYou have\n- Coursework or projects in data analysis, statistics or SQL\n- Curiosity about education and learning outcomes\n- Clear communication of numbers to non-technical teammates',
  },
  {
    id: 'al-graduate-product',
    title: 'Graduate Product Program',
    company: 'Archipelago Logistics',
    industry: 'Logistics',
    location: 'Surabaya, Indonesia',
    workMode: 'ONSITE',
    employmentType: 'GRADUATE_PROGRAM',
    postedDaysAgo: 7,
    deadlineInDays: 21,
    skills: ['product discovery', 'user research', 'project management', 'communication', 'problem solving'],
    description:
      'A 12-month rotational program across our shipper app, driver app and warehouse systems. Graduates rotate through three product teams and finish with a full product role.\n\nThe program includes\n- Rotations in discovery, delivery and operations\n- Mentoring from senior product managers\n- A capstone product problem presented to leadership\n\nWe look for recent graduates who are hands-on, love solving operational problems and communicate clearly.',
  },
  {
    id: 'sh-growth-intern',
    title: 'Growth Product Intern',
    company: 'Sehatku Health',
    industry: 'HealthTech',
    location: 'Bandung, Indonesia',
    workMode: 'HYBRID',
    employmentType: 'INTERNSHIP',
    postedDaysAgo: 3,
    deadlineInDays: 12,
    skills: ['product analytics', 'a/b testing', 'user research', 'market research'],
    description:
      'Sehatku Health makes telemedicine affordable for families outside big cities. Join our growth team to improve activation and retention.\n\n- Analyse activation funnels and cohort retention\n- Run small experiments on onboarding\n- Interview patients and doctors about their needs\n\nIdeal for students who enjoy both numbers and people.',
  },
  {
    id: 'gdb-junior-po',
    title: 'Junior Product Owner',
    company: 'Garuda Digital Bank',
    industry: 'Fintech',
    location: 'Jakarta, Indonesia',
    workMode: 'ONSITE',
    employmentType: 'FULL_TIME',
    postedDaysAgo: 9,
    deadlineInDays: 18,
    skills: ['agile', 'scrum', 'product backlog', 'stakeholder management', 'communication'],
    description:
      'Own the backlog for our savings product within a scrum team of eight. You will translate customer and regulatory needs into well-defined user stories and work closely with risk and compliance.\n\nRequirements: 1+ year of experience in product, business analysis or software delivery; familiarity with Scrum; strong stakeholder management.',
  },
  {
    id: 'np-backend-intern',
    title: 'Software Engineer Intern (Backend)',
    company: 'Nusantara Pay',
    industry: 'Fintech',
    location: 'Jakarta, Indonesia',
    workMode: 'HYBRID',
    employmentType: 'INTERNSHIP',
    postedDaysAgo: 4,
    deadlineInDays: 9,
    skills: ['node.js', 'typescript', 'rest api', 'postgresql', 'git', 'testing'],
    description:
      'Build payment APIs used by millions of transactions a day. You will work in TypeScript and Node.js on our merchant settlement services.\n\n- Build and test REST APIs\n- Write PostgreSQL queries and migrations\n- Participate in code reviews and on-call shadowing\n\nRequirements: solid programming fundamentals, data structures and algorithms, Git; Node.js or similar experience.',
  },
  {
    id: 'kl-frontend-intern',
    title: 'Frontend Engineer Intern',
    company: 'Kopiloka',
    industry: 'E-commerce',
    location: 'Jakarta, Indonesia',
    workMode: 'HYBRID',
    employmentType: 'INTERNSHIP',
    postedDaysAgo: 6,
    deadlineInDays: 15,
    skills: ['react', 'typescript', 'javascript', 'ui design', 'testing'],
    description:
      'Help us build a fast, accessible storefront in React and TypeScript. You will ship features to production, write component tests and collaborate with designers on our design system.',
  },
  {
    id: 'll-junior-fullstack',
    title: 'Junior Full-Stack Developer',
    company: 'Lumen Learning ID',
    industry: 'EdTech',
    location: 'Remote (Indonesia)',
    workMode: 'REMOTE',
    employmentType: 'FULL_TIME',
    postedDaysAgo: 8,
    deadlineInDays: 20,
    salaryRange: 'IDR 9–12M / month',
    skills: ['react', 'node.js', 'postgresql', 'rest api', 'git', 'docker'],
    description:
      'Work across our React front-end and Node.js services to ship learning features. 0–2 years of experience; strong portfolio projects welcome. You will own features from design review to deployment.',
  },
  {
    id: 'al-swe-graduate',
    title: 'Software Engineer, Graduate Program',
    company: 'Archipelago Logistics',
    industry: 'Logistics',
    location: 'Surabaya, Indonesia',
    workMode: 'ONSITE',
    employmentType: 'GRADUATE_PROGRAM',
    postedDaysAgo: 10,
    deadlineInDays: 24,
    skills: ['java', 'system design', 'data structures', 'algorithms', 'databases'],
    description:
      'A two-year engineering graduate program building routing and warehouse systems. Includes structured training in system design, mentoring and rotations across platform teams.',
  },
  {
    id: 'cai-ai-intern',
    title: 'AI Engineer Intern (LLM Applications)',
    company: 'Cendekia AI Lab',
    industry: 'Technology',
    location: 'Jakarta, Indonesia',
    workMode: 'HYBRID',
    employmentType: 'INTERNSHIP',
    postedDaysAgo: 2,
    deadlineInDays: 11,
    skills: ['python', 'llm', 'rag', 'langflow', 'prompt engineering', 'ai agent'],
    description:
      'Build retrieval-augmented assistants and tool-using agents for Indonesian enterprises. You will prototype flows, evaluate model outputs and help productionise them.\n\nYou have: Python, curiosity about LLMs, and at least one AI project you can show.',
  },
  {
    id: 'gdb-ml-intern',
    title: 'Machine Learning Engineer Intern',
    company: 'Garuda Digital Bank',
    industry: 'Fintech',
    location: 'Jakarta, Indonesia',
    workMode: 'ONSITE',
    employmentType: 'INTERNSHIP',
    postedDaysAgo: 12,
    deadlineInDays: 16,
    skills: ['python', 'machine learning', 'scikit-learn', 'statistics', 'sql', 'mlops'],
    description:
      'Join the credit risk modelling team. Train and evaluate models, monitor them in production and document results for model governance.',
  },
  {
    id: 'cai-junior-ai',
    title: 'Junior AI Engineer',
    company: 'Cendekia AI Lab',
    industry: 'Technology',
    location: 'Remote (Indonesia)',
    workMode: 'REMOTE',
    employmentType: 'FULL_TIME',
    postedDaysAgo: 5,
    deadlineInDays: 19,
    skills: ['python', 'llm', 'rag', 'ai agent', 'rest api', 'docker'],
    description:
      'Ship LLM features end to end: retrieval pipelines, agent tools, evaluation and deployment. 0–2 years of experience with a strong AI portfolio.',
  },
  {
    id: 'kl-data-intern',
    title: 'Data Analyst Intern',
    company: 'Kopiloka',
    industry: 'E-commerce',
    location: 'Jakarta, Indonesia',
    workMode: 'HYBRID',
    employmentType: 'INTERNSHIP',
    postedDaysAgo: 3,
    deadlineInDays: 13,
    skills: ['sql', 'excel', 'data visualization', 'statistics', 'communication'],
    description:
      'Turn order and roaster data into insights. Build Looker dashboards, answer ad-hoc questions with SQL and present findings to category managers.',
  },
  {
    id: 'al-bi-analyst',
    title: 'Junior Business Intelligence Analyst',
    company: 'Archipelago Logistics',
    industry: 'Logistics',
    location: 'Surabaya, Indonesia',
    workMode: 'HYBRID',
    employmentType: 'FULL_TIME',
    postedDaysAgo: 11,
    deadlineInDays: 22,
    skills: ['sql', 'power bi', 'data analysis', 'excel', 'business case'],
    description:
      'Own operational reporting for our fleet. Model data, build Power BI dashboards and support business cases with analysis.',
  },
  {
    id: 'gdb-data-graduate',
    title: 'Data Analyst Graduate Program',
    company: 'Garuda Digital Bank',
    industry: 'Fintech',
    location: 'Jakarta, Indonesia',
    workMode: 'ONSITE',
    employmentType: 'GRADUATE_PROGRAM',
    postedDaysAgo: 6,
    deadlineInDays: 17,
    skills: ['sql', 'python', 'statistics', 'data visualization', 'communication'],
    description:
      'A one-year program rotating through marketing, risk and product analytics with structured training in SQL, Python and statistics.',
  },
  {
    id: 'll-uiux-intern',
    title: 'UI/UX Designer Intern',
    company: 'Lumen Learning ID',
    industry: 'EdTech',
    location: 'Remote (Indonesia)',
    workMode: 'REMOTE',
    employmentType: 'INTERNSHIP',
    postedDaysAgo: 4,
    deadlineInDays: 12,
    skills: ['figma', 'ux design', 'ui design', 'prototyping', 'usability testing'],
    description:
      'Design learning experiences used by students every day. Create flows and prototypes in Figma and test them with students and teachers.',
  },
  {
    id: 'np-product-designer-intern',
    title: 'Product Designer Intern',
    company: 'Nusantara Pay',
    industry: 'Fintech',
    location: 'Jakarta, Indonesia',
    workMode: 'HYBRID',
    employmentType: 'INTERNSHIP',
    postedDaysAgo: 5,
    deadlineInDays: 14,
    skills: ['figma', 'ux design', 'design system', 'user research', 'prototyping'],
    description:
      'Design merchant tools in our design system, from research to high-fidelity prototypes. You will pair with a senior designer and present your work in design critiques.',
  },
  {
    id: 'sh-ux-researcher',
    title: 'Junior UX Researcher',
    company: 'Sehatku Health',
    industry: 'HealthTech',
    location: 'Bandung, Indonesia',
    workMode: 'HYBRID',
    employmentType: 'FULL_TIME',
    postedDaysAgo: 9,
    deadlineInDays: 20,
    skills: ['user research', 'usability testing', 'survey design', 'communication'],
    description:
      'Plan and run research with patients and doctors across Indonesia. Synthesise insights that shape our roadmap.',
  },
  {
    id: 'll-product-ops-pt',
    title: 'Product Operations Assistant (Part-time)',
    company: 'Lumen Learning ID',
    industry: 'EdTech',
    location: 'Remote (Indonesia)',
    workMode: 'REMOTE',
    employmentType: 'PART_TIME',
    postedDaysAgo: 2,
    deadlineInDays: 9,
    skills: ['project management', 'spreadsheets', 'communication', 'product analytics'],
    description:
      'A 20-hour-per-week role supporting product launches: release notes, feedback triage and simple usage reports. Great for students who want product exposure alongside their studies.',
  },
];

// ---------------------------------------------------------------------------

export interface CuratedBook {
  key: string;
  title: string;
  authors: string[];
  year: number;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  skills: string[];
  roles: string[];
  infoUrl: string;
  description: string;
}

const openLibrarySearch = (title: string) => `https://openlibrary.org/search?q=${encodeURIComponent(title)}`;

export const CURATED_BOOKS: CuratedBook[] = [
  {
    key: 'inspired',
    title: 'Inspired: How to Create Tech Products Customers Love',
    authors: ['Marty Cagan'],
    year: 2017,
    level: 'Beginner',
    skills: ['product-strategy', 'product-discovery'],
    roles: ['product-manager'],
    infoUrl: openLibrarySearch('Inspired Marty Cagan'),
    description:
      'A foundational look at how strong product teams work: empowered teams, continuous discovery and the role of the product manager in finding solutions that are valuable, usable and feasible.',
  },
  {
    key: 'lean-analytics',
    title: 'Lean Analytics: Use Data to Build a Better Startup Faster',
    authors: ['Alistair Croll', 'Benjamin Yoskovitz'],
    year: 2013,
    level: 'Intermediate',
    skills: ['product-analytics', 'data-analysis'],
    roles: ['product-manager', 'data-analyst'],
    infoUrl: openLibrarySearch('Lean Analytics Croll'),
    description:
      'Practical guide to choosing the one metric that matters at each stage of a product, with benchmarks and case studies across business models. A strong bridge from metrics theory to product decisions.',
  },
  {
    key: 'trustworthy-experiments',
    title: 'Trustworthy Online Controlled Experiments',
    authors: ['Ron Kohavi', 'Diane Tang', 'Ya Xu'],
    year: 2020,
    level: 'Advanced',
    skills: ['ab-testing', 'product-analytics', 'statistics'],
    roles: ['product-manager', 'data-analyst'],
    infoUrl: openLibrarySearch('Trustworthy Online Controlled Experiments'),
    description:
      'The reference on running A/B tests well: metric design, common pitfalls, and building an experimentation culture, written by practitioners from large-scale experimentation platforms.',
  },
  {
    key: 'continuous-discovery',
    title: 'Continuous Discovery Habits',
    authors: ['Teresa Torres'],
    year: 2021,
    level: 'Intermediate',
    skills: ['product-discovery', 'user-research'],
    roles: ['product-manager', 'ux-designer'],
    infoUrl: openLibrarySearch('Continuous Discovery Habits'),
    description:
      'A structured approach to weekly customer interviews and opportunity solution trees, so product decisions stay grounded in evidence.',
  },
  {
    key: 'cracking-pm-interview',
    title: 'Cracking the PM Interview',
    authors: ['Gayle Laakmann McDowell', 'Jackie Bavaro'],
    year: 2013,
    level: 'Beginner',
    skills: ['product-strategy', 'communication'],
    roles: ['product-manager'],
    infoUrl: openLibrarySearch('Cracking the PM Interview'),
    description:
      'Covers what product management roles look like across companies and how to prepare for product sense, estimation and behavioural interviews.',
  },
  {
    key: 'sql-for-data-analysis',
    title: 'SQL for Data Analysis',
    authors: ['Cathy Tanimura'],
    year: 2021,
    level: 'Intermediate',
    skills: ['sql', 'data-analysis', 'product-analytics'],
    roles: ['data-analyst', 'product-manager'],
    infoUrl: openLibrarySearch('SQL for Data Analysis Tanimura'),
    description:
      'Applied SQL for analysts: time series, cohorts, text analysis and experiment analysis — exactly the queries product teams ask for.',
  },
  {
    key: 'storytelling-with-data',
    title: 'Storytelling with Data',
    authors: ['Cole Nussbaumer Knaflic'],
    year: 2015,
    level: 'Beginner',
    skills: ['data-visualization', 'communication'],
    roles: ['data-analyst', 'product-manager'],
    infoUrl: openLibrarySearch('Storytelling with Data'),
    description:
      'How to choose the right chart, remove clutter and guide attention so data leads to decisions.',
  },
  {
    key: 'naked-statistics',
    title: 'Naked Statistics',
    authors: ['Charles Wheelan'],
    year: 2013,
    level: 'Beginner',
    skills: ['statistics'],
    roles: ['data-analyst'],
    infoUrl: openLibrarySearch('Naked Statistics Wheelan'),
    description: 'An approachable tour of the statistical ideas behind everyday decisions, with intuition before formulas.',
  },
  {
    key: 'ddia',
    title: 'Designing Data-Intensive Applications',
    authors: ['Martin Kleppmann'],
    year: 2017,
    level: 'Advanced',
    skills: ['system-design', 'databases'],
    roles: ['software-engineer'],
    infoUrl: openLibrarySearch('Designing Data-Intensive Applications'),
    description:
      'A deep explanation of how databases, replication, partitioning and stream processing work — the backbone of system design interviews and real architectures.',
  },
  {
    key: 'pragmatic-programmer',
    title: 'The Pragmatic Programmer',
    authors: ['David Thomas', 'Andrew Hunt'],
    year: 2019,
    level: 'Beginner',
    skills: ['software-testing', 'git', 'problem-solving'],
    roles: ['software-engineer'],
    infoUrl: openLibrarySearch('The Pragmatic Programmer'),
    description: 'Timeless habits of effective engineers: ownership, automation, testing and continuous learning.',
  },
  {
    key: 'designing-ml-systems',
    title: 'Designing Machine Learning Systems',
    authors: ['Chip Huyen'],
    year: 2022,
    level: 'Intermediate',
    skills: ['mlops', 'machine-learning'],
    roles: ['ai-engineer'],
    infoUrl: openLibrarySearch('Designing Machine Learning Systems Huyen'),
    description: 'An iterative framework for building ML systems that work in production: data, features, deployment and monitoring.',
  },
  {
    key: 'ai-engineering',
    title: 'AI Engineering: Building Applications with Foundation Models',
    authors: ['Chip Huyen'],
    year: 2025,
    level: 'Intermediate',
    skills: ['llm-applications', 'rag', 'ai-agents', 'prompt-engineering'],
    roles: ['ai-engineer'],
    infoUrl: openLibrarySearch('AI Engineering Chip Huyen'),
    description: 'How to build applications on foundation models: evaluation, prompt engineering, RAG, agents and fine-tuning trade-offs.',
  },
  {
    key: 'hands-on-ml',
    title: 'Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow',
    authors: ['Aurélien Géron'],
    year: 2019,
    level: 'Intermediate',
    skills: ['machine-learning', 'deep-learning', 'python'],
    roles: ['ai-engineer'],
    infoUrl: openLibrarySearch('Hands-On Machine Learning Geron'),
    description: 'A project-driven introduction to classical ML and deep learning with clear code examples.',
  },
  {
    key: 'dont-make-me-think',
    title: "Don't Make Me Think, Revisited",
    authors: ['Steve Krug'],
    year: 2014,
    level: 'Beginner',
    skills: ['ux-design', 'usability-testing'],
    roles: ['ux-designer', 'product-manager'],
    infoUrl: openLibrarySearch("Don't Make Me Think Krug"),
    description: 'A short, practical classic on web usability and running lightweight usability tests.',
  },
  {
    key: 'design-everyday-things',
    title: 'The Design of Everyday Things',
    authors: ['Don Norman'],
    year: 2013,
    level: 'Beginner',
    skills: ['ux-design', 'ui-design'],
    roles: ['ux-designer'],
    infoUrl: openLibrarySearch('The Design of Everyday Things'),
    description: 'Introduces affordances, signifiers, feedback and human error — the vocabulary of human-centred design.',
  },
];

// ---------------------------------------------------------------------------

export interface CuratedPaper {
  key: string;
  title: string;
  authors: string[];
  year: number;
  venue: string;
  url: string;
  doi: string | null;
  skills: string[];
  roles: string[];
  summary: string;
}

export const CURATED_PAPERS: CuratedPaper[] = [
  {
    key: 'kohavi-2009',
    title: 'Controlled experiments on the web: survey and practical guide',
    authors: ['Ron Kohavi', 'Roger Longbotham', 'Dan Sommerfield', 'Randal M. Henne'],
    year: 2009,
    venue: 'Data Mining and Knowledge Discovery',
    url: 'https://doi.org/10.1007/s10618-008-0114-1',
    doi: '10.1007/s10618-008-0114-1',
    skills: ['ab-testing', 'product-analytics', 'statistics'],
    roles: ['product-manager', 'data-analyst'],
    summary:
      'A practical guide to running online controlled experiments (A/B tests): choosing an overall evaluation criterion, sizing experiments, and avoiding the pitfalls that lead teams to wrong conclusions.',
  },
  {
    key: 'rodden-2010-heart',
    title: 'Measuring the User Experience on a Large Scale: User-Centered Metrics for Web Applications',
    authors: ['Kerry Rodden', 'Hilary Hutchinson', 'Xin Fu'],
    year: 2010,
    venue: 'CHI 2010',
    url: 'https://doi.org/10.1145/1753326.1753687',
    doi: '10.1145/1753326.1753687',
    skills: ['product-analytics', 'ux-design'],
    roles: ['product-manager', 'ux-designer'],
    summary:
      'Introduces the HEART framework (Happiness, Engagement, Adoption, Retention, Task success) and the Goals–Signals–Metrics process for turning product goals into measurable user-centred metrics.',
  },
  {
    key: 'davis-1989-tam',
    title: 'Perceived Usefulness, Perceived Ease of Use, and User Acceptance of Information Technology',
    authors: ['Fred D. Davis'],
    year: 1989,
    venue: 'MIS Quarterly',
    url: 'https://doi.org/10.2307/249008',
    doi: '10.2307/249008',
    skills: ['user-research', 'product-strategy'],
    roles: ['product-manager', 'ux-designer'],
    summary:
      'The origin of the Technology Acceptance Model: people adopt technology largely based on how useful and how easy to use they believe it is — a lens product teams still use to reason about adoption.',
  },
  {
    key: 'wickham-2014-tidy',
    title: 'Tidy Data',
    authors: ['Hadley Wickham'],
    year: 2014,
    venue: 'Journal of Statistical Software',
    url: 'https://doi.org/10.18637/jss.v059.i10',
    doi: '10.18637/jss.v059.i10',
    skills: ['data-analysis', 'statistics'],
    roles: ['data-analyst'],
    summary: 'Defines a simple standard for structuring datasets (one variable per column, one observation per row) that makes cleaning and analysis far easier.',
  },
  {
    key: 'codd-1970',
    title: 'A Relational Model of Data for Large Shared Data Banks',
    authors: ['E. F. Codd'],
    year: 1970,
    venue: 'Communications of the ACM',
    url: 'https://doi.org/10.1145/362384.362685',
    doi: '10.1145/362384.362685',
    skills: ['sql', 'databases'],
    roles: ['data-analyst', 'software-engineer'],
    summary: 'The paper that introduced the relational model, the foundation of SQL databases. Understanding it makes joins and normalisation intuitive.',
  },
  {
    key: 'dean-2008-mapreduce',
    title: 'MapReduce: Simplified Data Processing on Large Clusters',
    authors: ['Jeffrey Dean', 'Sanjay Ghemawat'],
    year: 2008,
    venue: 'Communications of the ACM',
    url: 'https://doi.org/10.1145/1327452.1327492',
    doi: '10.1145/1327452.1327492',
    skills: ['system-design'],
    roles: ['software-engineer'],
    summary: 'Describes a programming model for processing massive datasets across clusters, and the engineering behind making it fault tolerant — a classic for system design thinking.',
  },
  {
    key: 'nielsen-1990',
    title: 'Heuristic evaluation of user interfaces',
    authors: ['Jakob Nielsen', 'Rolf Molich'],
    year: 1990,
    venue: 'CHI 1990',
    url: 'https://doi.org/10.1145/97243.97281',
    doi: '10.1145/97243.97281',
    skills: ['usability-testing', 'ux-design'],
    roles: ['ux-designer'],
    summary: 'Shows that small groups of evaluators applying usability heuristics find most interface problems cheaply — the basis of heuristic evaluation.',
  },
  {
    key: 'vaswani-2017',
    title: 'Attention Is All You Need',
    authors: ['Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar', 'Jakob Uszkoreit', 'Llion Jones', 'Aidan N. Gomez'],
    year: 2017,
    venue: 'NeurIPS 2017',
    url: 'https://arxiv.org/abs/1706.03762',
    doi: null,
    skills: ['deep-learning', 'nlp', 'llm-applications'],
    roles: ['ai-engineer'],
    summary: 'Introduces the Transformer architecture built entirely on attention, the foundation of modern large language models.',
  },
  {
    key: 'lewis-2020-rag',
    title: 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks',
    authors: ['Patrick Lewis', 'Ethan Perez', 'Aleksandra Piktus', 'Fabio Petroni', 'Vladimir Karpukhin'],
    year: 2020,
    venue: 'NeurIPS 2020',
    url: 'https://arxiv.org/abs/2005.11401',
    doi: null,
    skills: ['rag', 'nlp', 'llm-applications'],
    roles: ['ai-engineer'],
    summary: 'Combines a retriever with a generator so models ground answers in retrieved documents — the origin of the RAG pattern.',
  },
  {
    key: 'yao-2022-react',
    title: 'ReAct: Synergizing Reasoning and Acting in Language Models',
    authors: ['Shunyu Yao', 'Jeffrey Zhao', 'Dian Yu', 'Nan Du', 'Izhak Shafran', 'Karthik Narasimhan', 'Yuan Cao'],
    year: 2022,
    venue: 'arXiv / ICLR 2023',
    url: 'https://arxiv.org/abs/2210.03629',
    doi: null,
    skills: ['ai-agents', 'llm-applications', 'prompt-engineering'],
    roles: ['ai-engineer'],
    summary: 'Interleaves reasoning traces with tool actions so language models can plan, act and update plans — the core loop behind tool-using agents like Orbit.',
  },
  {
    key: 'devlin-2018-bert',
    title: 'BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding',
    authors: ['Jacob Devlin', 'Ming-Wei Chang', 'Kenton Lee', 'Kristina Toutanova'],
    year: 2018,
    venue: 'arXiv / NAACL 2019',
    url: 'https://arxiv.org/abs/1810.04805',
    doi: null,
    skills: ['nlp', 'deep-learning'],
    roles: ['ai-engineer'],
    summary: 'Pre-trains a bidirectional Transformer and fine-tunes it for many language tasks, setting the template for transfer learning in NLP.',
  },
];

// ---------------------------------------------------------------------------

export interface CuratedEvent {
  key: string;
  title: string;
  type: EventType;
  organizer: string;
  /** days from seeding; time is set in WIB (UTC+7) */
  inDays: number;
  hourWib: number;
  durationHours: number;
  registrationInDays?: number;
  location: string;
  isOnline: boolean;
  cost: string;
  skills: string[];
  roles: string[];
  description: string;
}

export const CURATED_EVENTS: CuratedEvent[] = [
  {
    key: 'product-analytics-workshop',
    title: 'Product Analytics Workshop: From Metrics to Decisions',
    type: 'WORKSHOP',
    organizer: 'Jakarta Product Circle',
    inDays: 1,
    hourWib: 19,
    durationHours: 2,
    location: 'Online',
    isOnline: true,
    cost: 'Free',
    skills: ['product-analytics', 'sql', 'ab-testing'],
    roles: ['product-manager', 'data-analyst'],
    description:
      'A hands-on evening workshop: define a north star metric, build a funnel and cohort analysis in SQL, and turn the result into a product decision. Includes a take-home dataset.',
  },
  {
    key: 'ai-agents-builder-day',
    title: 'AI Agents Builder Day',
    type: 'WORKSHOP',
    organizer: 'Jakarta AI Builders',
    inDays: 6,
    hourWib: 9,
    durationHours: 6,
    registrationInDays: 4,
    location: 'Jakarta',
    isOnline: false,
    cost: 'Free',
    skills: ['ai-agents', 'llm-applications', 'rag'],
    roles: ['ai-engineer', 'software-engineer'],
    description: 'Build a tool-using agent in a day with visual flows, retrieval and evaluation. Bring a laptop; teams of two.',
  },
  {
    key: 'pm-meetup',
    title: 'Product Management Meetup: Breaking into Product',
    type: 'CAREER_EVENT',
    organizer: 'Jakarta Product Circle',
    inDays: 9,
    hourWib: 18,
    durationHours: 3,
    location: 'Jakarta',
    isOnline: false,
    cost: 'Free',
    skills: ['product-strategy', 'communication', 'stakeholder-management'],
    roles: ['product-manager'],
    description: 'Panel and networking with product managers who started as engineers, designers and analysts. Bring your questions about the first PM role.',
  },
  {
    key: 'system-design-seminar',
    title: 'System Design in Practice',
    type: 'SEMINAR',
    organizer: 'Indonesia Engineers Guild',
    inDays: 11,
    hourWib: 19,
    durationHours: 2,
    location: 'Online',
    isOnline: true,
    cost: 'Free',
    skills: ['system-design', 'databases'],
    roles: ['software-engineer'],
    description: 'Senior engineers walk through real architectures and the trade-offs behind them.',
  },
  {
    key: 'data-storytelling-bootcamp',
    title: 'Data Storytelling Bootcamp',
    type: 'BOOTCAMP',
    organizer: 'Nusantara Data Academy',
    inDays: 14,
    hourWib: 9,
    durationHours: 16,
    registrationInDays: 8,
    location: 'Online',
    isOnline: true,
    cost: 'IDR 350K',
    skills: ['data-visualization', 'communication', 'data-analysis'],
    roles: ['data-analyst', 'product-manager'],
    description: 'Two weekends of dashboards, narrative and presenting insights to stakeholders, with feedback from practitioners.',
  },
  {
    key: 'campus-career-fair',
    title: 'Campus Tech Career Fair 2026',
    type: 'CAREER_EVENT',
    organizer: 'Jakarta Campus Career Network',
    inDays: 16,
    hourWib: 10,
    durationHours: 7,
    location: 'Jakarta',
    isOnline: false,
    cost: 'Free',
    skills: ['communication'],
    roles: ['product-manager', 'software-engineer', 'data-analyst', 'ux-designer', 'ai-engineer'],
    description: 'Meet 40+ tech companies hiring interns and graduates. CV clinic and mock interviews on site.',
  },
  {
    key: 'national-product-hackathon',
    title: 'National Product & UX Hackathon 2026',
    type: 'HACKATHON',
    organizer: 'Nusantara Tech Community',
    inDays: 20,
    hourWib: 8,
    durationHours: 36,
    registrationInDays: 12,
    location: 'Bandung',
    isOnline: false,
    cost: 'Free',
    skills: ['product-discovery', 'prototyping', 'ux-design', 'public-speaking'],
    roles: ['product-manager', 'ux-designer', 'software-engineer'],
    description: '36 hours to discover a real problem, prototype a solution and pitch it. Great portfolio material and a credible competition achievement.',
  },
  {
    key: 'business-case-competition',
    title: 'Digital Business Case Competition',
    type: 'COMPETITION',
    organizer: 'Indonesia Business Students Forum',
    inDays: 25,
    hourWib: 9,
    durationHours: 8,
    registrationInDays: 15,
    location: 'Online',
    isOnline: true,
    cost: 'Free',
    skills: ['business-strategy', 'market-research', 'product-strategy'],
    roles: ['product-manager', 'data-analyst'],
    description: 'Solve a real digital-business case in teams of three and present to industry judges.',
  },
  {
    key: 'ux-research-seminar',
    title: 'UX Research Methods Seminar',
    type: 'SEMINAR',
    organizer: 'Indonesia UX Society',
    inDays: 8,
    hourWib: 19,
    durationHours: 2,
    location: 'Online',
    isOnline: true,
    cost: 'Free',
    skills: ['user-research', 'usability-testing'],
    roles: ['ux-designer', 'product-manager'],
    description: 'Choosing the right research method, recruiting participants and synthesising findings fast.',
  },
];

// ---------------------------------------------------------------------------

export interface CuratedResource {
  key: string;
  title: string;
  type: ResourceType;
  provider: string;
  url: string;
  durationHours: number | null;
  level: string;
  cost: string;
  skills: string[];
  roles: string[];
  description: string;
}

export const CURATED_RESOURCES: CuratedResource[] = [
  {
    key: 'mode-sql',
    title: 'SQL Tutorial for Data Analysis',
    type: 'COURSE',
    provider: 'Mode',
    url: 'https://mode.com/sql-tutorial/',
    durationHours: 8,
    level: 'Beginner',
    cost: 'Free',
    skills: ['sql', 'product-analytics', 'data-analysis'],
    roles: ['product-manager', 'data-analyst'],
    description: 'Interactive SQL lessons built around real analytics questions, from basics to window functions.',
  },
  {
    key: 'kaggle-intro-sql',
    title: 'Intro to SQL',
    type: 'COURSE',
    provider: 'Kaggle Learn',
    url: 'https://www.kaggle.com/learn/intro-to-sql',
    durationHours: 3,
    level: 'Beginner',
    cost: 'Free',
    skills: ['sql'],
    roles: ['data-analyst', 'product-manager', 'ai-engineer'],
    description: 'Short hands-on course on SELECT, GROUP BY and JOIN with BigQuery public datasets. Includes a completion certificate.',
  },
  {
    key: 'kaggle-advanced-sql',
    title: 'Advanced SQL',
    type: 'COURSE',
    provider: 'Kaggle Learn',
    url: 'https://www.kaggle.com/learn/advanced-sql',
    durationHours: 4,
    level: 'Intermediate',
    cost: 'Free',
    skills: ['sql', 'data-analysis'],
    roles: ['data-analyst'],
    description: 'Window functions, analytic queries and efficient SQL for larger datasets.',
  },
  {
    key: 'google-data-analytics',
    title: 'Google Data Analytics Professional Certificate',
    type: 'CERTIFICATION',
    provider: 'Coursera',
    url: 'https://www.coursera.org/professional-certificates/google-data-analytics',
    durationHours: 180,
    level: 'Beginner',
    cost: 'Paid (financial aid available)',
    skills: ['data-analysis', 'sql', 'spreadsheets', 'data-visualization'],
    roles: ['data-analyst', 'product-manager'],
    description: 'A complete entry-level analytics program covering spreadsheets, SQL, Tableau and R, with a capstone project.',
  },
  {
    key: 'google-ux',
    title: 'Google UX Design Professional Certificate',
    type: 'CERTIFICATION',
    provider: 'Coursera',
    url: 'https://www.coursera.org/professional-certificates/google-ux-design',
    durationHours: 200,
    level: 'Beginner',
    cost: 'Paid (financial aid available)',
    skills: ['ux-design', 'figma', 'prototyping', 'usability-testing'],
    roles: ['ux-designer'],
    description: 'From research to high-fidelity prototypes in Figma, with three portfolio projects.',
  },
  {
    key: 'ibm-skillsbuild',
    title: 'IBM SkillsBuild — AI and Data Learning Paths',
    type: 'COURSE',
    provider: 'IBM SkillsBuild',
    url: 'https://skillsbuild.org/',
    durationHours: 10,
    level: 'Beginner',
    cost: 'Free',
    skills: ['machine-learning', 'llm-applications', 'data-analysis'],
    roles: ['ai-engineer', 'data-analyst', 'product-manager'],
    description: 'Free learning paths and digital credentials on AI fundamentals, data and professional skills.',
  },
  {
    key: 'svpg-articles',
    title: 'Product Management Articles',
    type: 'ARTICLE',
    provider: 'Silicon Valley Product Group',
    url: 'https://www.svpg.com/articles/',
    durationHours: 2,
    level: 'All levels',
    cost: 'Free',
    skills: ['product-strategy', 'product-discovery'],
    roles: ['product-manager'],
    description: 'Essays on product discovery, empowered teams and product strategy from experienced product leaders.',
  },
  {
    key: 'nngroup-articles',
    title: 'UX Research and Design Articles',
    type: 'ARTICLE',
    provider: 'Nielsen Norman Group',
    url: 'https://www.nngroup.com/articles/',
    durationHours: 2,
    level: 'All levels',
    cost: 'Free',
    skills: ['user-research', 'ux-design', 'usability-testing'],
    roles: ['ux-designer', 'product-manager'],
    description: 'Evidence-based articles on research methods, usability and interaction design.',
  },
  {
    key: 'laws-of-ux',
    title: 'Laws of UX',
    type: 'LEARNING_RESOURCE',
    provider: 'Jon Yablonski',
    url: 'https://lawsofux.com/',
    durationHours: 1,
    level: 'Beginner',
    cost: 'Free',
    skills: ['ux-design', 'ui-design'],
    roles: ['ux-designer'],
    description: 'A concise collection of psychology principles designers use to build intuitive interfaces.',
  },
  {
    key: 'system-design-primer',
    title: 'The System Design Primer',
    type: 'LEARNING_RESOURCE',
    provider: 'GitHub (open source)',
    url: 'https://github.com/donnemartin/system-design-primer',
    durationHours: 20,
    level: 'Intermediate',
    cost: 'Free',
    skills: ['system-design', 'databases'],
    roles: ['software-engineer'],
    description: 'An open-source guide to designing large-scale systems with worked interview examples.',
  },
  {
    key: 'hf-llm-course',
    title: 'Hugging Face LLM Course',
    type: 'COURSE',
    provider: 'Hugging Face',
    url: 'https://huggingface.co/learn',
    durationHours: 20,
    level: 'Intermediate',
    cost: 'Free',
    skills: ['nlp', 'llm-applications', 'deep-learning'],
    roles: ['ai-engineer'],
    description: 'Transformers, tokenisers, fine-tuning and building LLM applications with open models.',
  },
  {
    key: 'dlai-short-courses',
    title: 'Short Courses on Agents and RAG',
    type: 'COURSE',
    provider: 'DeepLearning.AI',
    url: 'https://www.deeplearning.ai/short-courses/',
    durationHours: 2,
    level: 'Beginner',
    cost: 'Free',
    skills: ['ai-agents', 'rag', 'prompt-engineering'],
    roles: ['ai-engineer'],
    description: 'One-to-two-hour hands-on courses on agents, retrieval and evaluation.',
  },
  {
    key: 'langflow-docs',
    title: 'Langflow Documentation and Tutorials',
    type: 'LEARNING_RESOURCE',
    provider: 'Langflow',
    url: 'https://docs.langflow.org/',
    durationHours: 3,
    level: 'Beginner',
    cost: 'Free',
    skills: ['ai-agents', 'llm-applications'],
    roles: ['ai-engineer', 'software-engineer'],
    description: 'Build agent and RAG flows visually, then call them from your application through the API.',
  },
  {
    key: 'freecodecamp',
    title: 'JavaScript Algorithms and Data Structures',
    type: 'CERTIFICATION',
    provider: 'freeCodeCamp',
    url: 'https://www.freecodecamp.org/learn',
    durationHours: 300,
    level: 'Beginner',
    cost: 'Free',
    skills: ['javascript', 'dsa'],
    roles: ['software-engineer'],
    description: 'Self-paced curriculum with projects and a free certification.',
  },
  {
    key: 'exponent-pm',
    title: 'Product Management Interview Practice',
    type: 'LEARNING_RESOURCE',
    provider: 'Exponent',
    url: 'https://www.tryexponent.com/',
    durationHours: 5,
    level: 'Intermediate',
    cost: 'Freemium',
    skills: ['product-strategy', 'communication'],
    roles: ['product-manager'],
    description: 'Sample product sense, execution and estimation questions with example answers.',
  },
];

// ---------------------------------------------------------------------------

export interface CuratedPerson {
  slug: string;
  kind: 'ROLE_MODEL' | 'MENTOR';
  name: string;
  headline: string;
  careerSummary: string;
  publicSources: { label: string; url: string }[];
  skills: string[];
  expertise: string[];
  careerTransitions: { period: string; title: string; organization: string }[];
  relatedRoleSlugs: string[];
  earlyCareerSignals: string[];
  location: string | null;
  availability: string | null;
  isDemo: boolean;
}

export const CURATED_PEOPLE: CuratedPerson[] = [
  {
    slug: 'sundar-pichai',
    kind: 'ROLE_MODEL',
    name: 'Sundar Pichai',
    headline: 'CEO of Google and Alphabet',
    careerSummary:
      'Trained as an engineer, worked in technology and management consulting, then joined Google as a product manager. He led widely used products such as the Chrome browser before becoming CEO of Google and later Alphabet.',
    publicSources: [{ label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Sundar_Pichai' }],
    skills: ['product-strategy', 'leadership', 'stakeholder-management', 'communication', 'problem-solving'],
    expertise: ['Product leadership', 'Platform strategy'],
    careerTransitions: [
      { period: 'Early career', title: 'Engineering and consulting', organization: 'Applied Materials, McKinsey & Company' },
      { period: '2004', title: 'Product Manager', organization: 'Google' },
      { period: '2015', title: 'CEO', organization: 'Google' },
    ],
    relatedRoleSlugs: ['product-manager'],
    earlyCareerSignals: ['technical-background', 'business-exposure', 'product-ownership'],
    location: null,
    availability: null,
    isDemo: false,
  },
  {
    slug: 'william-tanuwijaya',
    kind: 'ROLE_MODEL',
    name: 'William Tanuwijaya',
    headline: 'Co-founder of Tokopedia',
    careerSummary:
      'Studied information technology in Jakarta while working to support himself, then worked as a software developer before co-founding the marketplace Tokopedia in 2009, one of Indonesia’s largest e-commerce platforms.',
    publicSources: [{ label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/William_Tanuwijaya' }],
    skills: ['product-strategy', 'leadership', 'problem-solving', 'business-strategy'],
    expertise: ['Marketplace products', 'Founding teams'],
    careerTransitions: [
      { period: 'University', title: 'Information Technology student', organization: 'Bina Nusantara University' },
      { period: 'Early career', title: 'Software developer', organization: 'Several Indonesian companies' },
      { period: '2009', title: 'Co-founder', organization: 'Tokopedia' },
    ],
    relatedRoleSlugs: ['product-manager', 'software-engineer'],
    earlyCareerSignals: ['technical-background', 'project-delivery', 'product-ownership'],
    location: 'Jakarta, Indonesia',
    availability: null,
    isDemo: false,
  },
  {
    slug: 'satya-nadella',
    kind: 'ROLE_MODEL',
    name: 'Satya Nadella',
    headline: 'Chairman and CEO of Microsoft',
    careerSummary:
      'An electrical engineer and computer scientist who joined Microsoft in the early 1990s, led its cloud and enterprise businesses, and became CEO in 2014.',
    publicSources: [{ label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Satya_Nadella' }],
    skills: ['system-design', 'leadership', 'cloud-devops', 'business-strategy'],
    expertise: ['Cloud platforms', 'Engineering leadership'],
    careerTransitions: [
      { period: '1992', title: 'Engineer', organization: 'Microsoft' },
      { period: '2011', title: 'President, Server & Tools', organization: 'Microsoft' },
      { period: '2014', title: 'CEO', organization: 'Microsoft' },
    ],
    relatedRoleSlugs: ['software-engineer'],
    earlyCareerSignals: ['technical-background', 'engineering-depth'],
    location: null,
    availability: null,
    isDemo: false,
  },
  {
    slug: 'andrew-ng',
    kind: 'ROLE_MODEL',
    name: 'Andrew Ng',
    headline: 'Founder of DeepLearning.AI, co-founder of Coursera',
    careerSummary:
      'A machine learning researcher and educator who co-founded Google Brain, co-founded Coursera, and founded DeepLearning.AI, teaching AI to millions of learners.',
    publicSources: [{ label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Andrew_Ng' }],
    skills: ['machine-learning', 'deep-learning', 'communication', 'leadership'],
    expertise: ['Machine learning', 'AI education'],
    careerTransitions: [
      { period: 'Academia', title: 'Professor of Computer Science', organization: 'Stanford University' },
      { period: '2011', title: 'Co-founder', organization: 'Google Brain' },
      { period: '2012', title: 'Co-founder', organization: 'Coursera' },
    ],
    relatedRoleSlugs: ['ai-engineer'],
    earlyCareerSignals: ['research', 'technical-background'],
    location: null,
    availability: null,
    isDemo: false,
  },
  {
    slug: 'fei-fei-li',
    kind: 'ROLE_MODEL',
    name: 'Fei-Fei Li',
    headline: 'Professor of Computer Science, Stanford University',
    careerSummary:
      'A computer vision researcher best known for creating ImageNet, which accelerated modern deep learning, and for advancing human-centred AI.',
    publicSources: [{ label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Fei-Fei_Li' }],
    skills: ['deep-learning', 'machine-learning', 'leadership'],
    expertise: ['Computer vision', 'Human-centred AI'],
    careerTransitions: [
      { period: 'Research', title: 'Created ImageNet', organization: 'Princeton and Stanford' },
      { period: 'Industry', title: 'Chief Scientist of AI/ML', organization: 'Google Cloud' },
    ],
    relatedRoleSlugs: ['ai-engineer'],
    earlyCareerSignals: ['research', 'technical-background'],
    location: null,
    availability: null,
    isDemo: false,
  },
  {
    slug: 'chip-huyen',
    kind: 'ROLE_MODEL',
    name: 'Chip Huyen',
    headline: 'AI engineer and author of “AI Engineering”',
    careerSummary:
      'Writer and engineer focused on machine learning systems in production; author of “Designing Machine Learning Systems” and “AI Engineering”, and former instructor of an ML systems course at Stanford.',
    publicSources: [{ label: 'Personal website', url: 'https://huyenchip.com/' }],
    skills: ['mlops', 'llm-applications', 'machine-learning', 'communication'],
    expertise: ['ML systems', 'Foundation model applications'],
    careerTransitions: [
      { period: 'Education', title: 'Computer Science', organization: 'Stanford University' },
      { period: 'Industry', title: 'ML engineer and startup founder', organization: 'Several AI companies' },
    ],
    relatedRoleSlugs: ['ai-engineer'],
    earlyCareerSignals: ['writing', 'project-delivery', 'technical-background'],
    location: null,
    availability: null,
    isDemo: false,
  },
  {
    slug: 'julie-zhuo',
    kind: 'ROLE_MODEL',
    name: 'Julie Zhuo',
    headline: 'Former VP of Product Design at Facebook, author of “The Making of a Manager”',
    careerSummary:
      'Studied computer science, joined Facebook early in its history and grew into leading product design, later writing a widely read book on becoming a manager.',
    publicSources: [{ label: 'Personal website', url: 'https://www.juliezhuo.com/' }],
    skills: ['ux-design', 'leadership', 'communication', 'product-strategy'],
    expertise: ['Product design', 'Design leadership'],
    careerTransitions: [
      { period: 'Education', title: 'Computer Science', organization: 'Stanford University' },
      { period: 'Early career', title: 'Product designer', organization: 'Facebook' },
      { period: 'Later', title: 'VP of Product Design', organization: 'Facebook' },
    ],
    relatedRoleSlugs: ['ux-designer', 'product-manager'],
    earlyCareerSignals: ['technical-background', 'design-craft'],
    location: null,
    availability: null,
    isDemo: false,
  },
  {
    slug: 'dj-patil',
    kind: 'ROLE_MODEL',
    name: 'DJ Patil',
    headline: 'First U.S. Chief Data Scientist',
    careerSummary:
      'A mathematician who led data teams in industry, including at LinkedIn, helped popularise the title “data scientist”, and served as the first U.S. Chief Data Scientist.',
    publicSources: [{ label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/DJ_Patil' }],
    skills: ['data-analysis', 'statistics', 'leadership', 'communication'],
    expertise: ['Data science', 'Data for public good'],
    careerTransitions: [
      { period: 'Industry', title: 'Head of Data Products', organization: 'LinkedIn' },
      { period: '2015', title: 'Chief Data Scientist', organization: 'U.S. Office of Science and Technology Policy' },
    ],
    relatedRoleSlugs: ['data-analyst'],
    earlyCareerSignals: ['research', 'technical-background'],
    location: null,
    availability: null,
    isDemo: false,
  },
  // ------------------------- Demo mentors (fictional) -------------------------
  {
    slug: 'mentor-rina-kartika',
    kind: 'MENTOR',
    name: 'Rina Kartika',
    headline: 'Senior Product Manager · Fintech',
    careerSummary:
      'Moved from software engineering into product after leading her campus app project. Now leads merchant growth products and mentors students breaking into product management.',
    publicSources: [],
    skills: ['product-analytics', 'product-discovery', 'sql', 'stakeholder-management'],
    expertise: ['Engineer-to-PM transitions', 'Product analytics', 'PM interviews'],
    careerTransitions: [
      { period: 'Years 0–2', title: 'Software Engineer', organization: 'Payments startup' },
      { period: 'Years 2–4', title: 'Associate Product Manager', organization: 'E-commerce company' },
      { period: 'Now', title: 'Senior Product Manager', organization: 'Fintech company' },
    ],
    relatedRoleSlugs: ['product-manager'],
    earlyCareerSignals: ['technical-background', 'project-delivery', 'product-ownership'],
    location: 'Jakarta, Indonesia',
    availability: '2 mentoring slots per month',
    isDemo: true,
  },
  {
    slug: 'mentor-arif-nugroho',
    kind: 'MENTOR',
    name: 'Arif Nugroho',
    headline: 'Staff Software Engineer · Logistics',
    careerSummary: 'Builds routing and warehouse platforms at scale and coaches early-career engineers on system design and code quality.',
    publicSources: [],
    skills: ['system-design', 'databases', 'java', 'cloud-devops'],
    expertise: ['System design', 'Backend architecture'],
    careerTransitions: [
      { period: 'Years 0–3', title: 'Backend Engineer', organization: 'Logistics startup' },
      { period: 'Now', title: 'Staff Software Engineer', organization: 'Logistics company' },
    ],
    relatedRoleSlugs: ['software-engineer'],
    earlyCareerSignals: ['technical-background', 'engineering-depth'],
    location: 'Surabaya, Indonesia',
    availability: '1 mentoring slot per month',
    isDemo: true,
  },
  {
    slug: 'mentor-sari-wulandari',
    kind: 'MENTOR',
    name: 'Sari Wulandari',
    headline: 'Lead UX Researcher · HealthTech',
    careerSummary: 'Leads research with patients and clinicians and mentors designers on research craft and portfolio case studies.',
    publicSources: [],
    skills: ['user-research', 'usability-testing', 'ux-design'],
    expertise: ['UX research', 'Portfolio reviews'],
    careerTransitions: [
      { period: 'Years 0–2', title: 'UI Designer', organization: 'Digital agency' },
      { period: 'Now', title: 'Lead UX Researcher', organization: 'HealthTech company' },
    ],
    relatedRoleSlugs: ['ux-designer', 'product-manager'],
    earlyCareerSignals: ['design-craft', 'research'],
    location: 'Bandung, Indonesia',
    availability: '2 mentoring slots per month',
    isDemo: true,
  },
  {
    slug: 'mentor-bima-prasetyo',
    kind: 'MENTOR',
    name: 'Bima Prasetyo',
    headline: 'Data Science Lead · Digital Banking',
    careerSummary: 'Started as a business intelligence analyst and now leads a data science team. Mentors analysts on SQL, statistics and storytelling.',
    publicSources: [],
    skills: ['sql', 'statistics', 'data-visualization', 'machine-learning'],
    expertise: ['Analytics careers', 'SQL', 'Experimentation'],
    careerTransitions: [
      { period: 'Years 0–3', title: 'BI Analyst', organization: 'Telecom company' },
      { period: 'Now', title: 'Data Science Lead', organization: 'Digital bank' },
    ],
    relatedRoleSlugs: ['data-analyst', 'ai-engineer'],
    earlyCareerSignals: ['technical-background', 'research'],
    location: 'Jakarta, Indonesia',
    availability: '1 mentoring slot per month',
    isDemo: true,
  },
  {
    slug: 'mentor-maya-hartono',
    kind: 'MENTOR',
    name: 'Maya Hartono',
    headline: 'AI Engineer · Enterprise AI',
    careerSummary: 'Builds retrieval and agent systems for enterprises. Mentors students shipping their first LLM projects.',
    publicSources: [],
    skills: ['llm-applications', 'rag', 'ai-agents', 'python'],
    expertise: ['LLM applications', 'AI portfolios'],
    careerTransitions: [
      { period: 'Years 0–2', title: 'Data Scientist', organization: 'Consulting firm' },
      { period: 'Now', title: 'AI Engineer', organization: 'Enterprise AI company' },
    ],
    relatedRoleSlugs: ['ai-engineer'],
    earlyCareerSignals: ['technical-background', 'project-delivery'],
    location: 'Jakarta, Indonesia',
    availability: '2 mentoring slots per month',
    isDemo: true,
  },
];
