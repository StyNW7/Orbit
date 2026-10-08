import type { ExperienceType, QuestCategory, ReadinessCategory } from '@orbit/shared';
import { SKILL_BY_SLUG } from './skills.catalog';

export interface ExperienceSignal {
  id: string;
  label: string;
  types: ExperienceType[];
  /** if non-empty, an experience must mention one of these to fully count */
  keywords: string[];
  weight: number;
}

export interface ResourceLink {
  title: string;
  url: string;
  kind: string;
}

export interface QuestTemplate {
  key: string;
  title: string;
  description: string;
  objective: string;
  category: QuestCategory;
  impact: ReadinessCategory;
  skillSlug?: string;
  /** proficiency points granted to the related skill at 100% */
  skillGain: number;
  effort: string;
  xp: number;
  evidenceRequirement?: string;
  evidenceRequired?: boolean;
  tasks: string[];
  resources?: ResourceLink[];
}

export interface MilestoneTemplate {
  key: string;
  title: string;
  description: string;
  impact: ReadinessCategory;
  skillSlug?: string;
  quests: QuestTemplate[];
}

export interface RoleDefinition {
  slug: string;
  title: string;
  family: string;
  description: string;
  icon: string;
  keywords: string[];
  requirements: { skill: string; level: number; importance: number }[];
  experienceSignals: ExperienceSignal[];
  journey: MilestoneTemplate[];
}

const R = {
  kaggleSql: { title: 'Kaggle Learn — Intro to SQL', url: 'https://www.kaggle.com/learn/intro-to-sql', kind: 'Course' },
  kaggleAdvSql: { title: 'Kaggle Learn — Advanced SQL', url: 'https://www.kaggle.com/learn/advanced-sql', kind: 'Course' },
  modeSql: { title: 'Mode SQL Tutorial', url: 'https://mode.com/sql-tutorial/', kind: 'Tutorial' },
  svpg: { title: 'SVPG articles on product', url: 'https://www.svpg.com/articles/', kind: 'Articles' },
  skillsbuild: { title: 'IBM SkillsBuild learning catalog', url: 'https://skillsbuild.org/', kind: 'Course' },
  googleDa: {
    title: 'Google Data Analytics Certificate',
    url: 'https://www.coursera.org/professional-certificates/google-data-analytics',
    kind: 'Certificate',
  },
  googleUx: {
    title: 'Google UX Design Certificate',
    url: 'https://www.coursera.org/professional-certificates/google-ux-design',
    kind: 'Certificate',
  },
  nngroup: { title: 'Nielsen Norman Group articles', url: 'https://www.nngroup.com/articles/', kind: 'Articles' },
  lawsOfUx: { title: 'Laws of UX', url: 'https://lawsofux.com/', kind: 'Reference' },
  sdPrimer: {
    title: 'System Design Primer',
    url: 'https://github.com/donnemartin/system-design-primer',
    kind: 'Guide',
  },
  roadmapBackend: { title: 'roadmap.sh — Backend', url: 'https://roadmap.sh/backend', kind: 'Roadmap' },
  roadmapAi: { title: 'roadmap.sh — AI Engineer', url: 'https://roadmap.sh/ai-engineer', kind: 'Roadmap' },
  hfCourse: { title: 'Hugging Face LLM Course', url: 'https://huggingface.co/learn', kind: 'Course' },
  dlaiShort: { title: 'DeepLearning.AI short courses', url: 'https://www.deeplearning.ai/short-courses/', kind: 'Course' },
  langflowDocs: { title: 'Langflow documentation', url: 'https://docs.langflow.org/', kind: 'Docs' },
  exponent: { title: 'Exponent interview prep', url: 'https://www.tryexponent.com/', kind: 'Practice' },
  leetcode: { title: 'LeetCode study plans', url: 'https://leetcode.com/studyplan/', kind: 'Practice' },
  freecodecamp: { title: 'freeCodeCamp curriculum', url: 'https://www.freecodecamp.org/learn', kind: 'Course' },
  mdn: { title: 'MDN Learn web development', url: 'https://developer.mozilla.org/en-US/docs/Learn', kind: 'Docs' },
} satisfies Record<string, ResourceLink>;

// ---------------------------------------------------------------------------
// Skill quest templates — used when a user adds a skill to their journey
// ---------------------------------------------------------------------------

export const SKILL_QUEST_TEMPLATES: Record<string, QuestTemplate> = {
  'product-analytics': {
    key: 'product-analytics-foundations',
    title: 'Product Analytics Foundations',
    description: 'Learn how product teams measure value: activation, retention, funnels and north star metrics.',
    objective: 'Be able to define, query and explain the core metrics of a real product.',
    category: 'SKILL',
    impact: 'SKILL',
    skillSlug: 'product-analytics',
    skillGain: 50,
    effort: '8 hours',
    xp: 150,
    evidenceRequirement: 'A link or short write-up of the metrics dashboard you built.',
    tasks: [
      'Learn the core product metrics: acquisition, activation, retention, revenue',
      'Complete an SQL analytics tutorial on funnels and cohorts',
      'Build a simple metrics dashboard for a product you use',
      'Write a one-page metric tree for one feature',
    ],
    resources: [R.modeSql, R.kaggleSql, R.svpg],
  },
  sql: {
    key: 'sql-for-product',
    title: 'SQL for Product Analysts',
    description: 'Go from SELECT to window functions so you can answer product questions on your own.',
    objective: 'Write queries for funnels, cohorts and retention without help.',
    category: 'SKILL',
    impact: 'SKILL',
    skillSlug: 'sql',
    skillGain: 40,
    effort: '10 hours',
    xp: 120,
    evidenceRequirement: 'A GitHub link or notebook with your solved queries.',
    tasks: [
      'Finish an introductory SQL course (SELECT, JOIN, GROUP BY)',
      'Practice 15 analytics-style questions',
      'Learn window functions for retention and ranking',
      'Publish your query notebook',
    ],
    resources: [R.kaggleSql, R.kaggleAdvSql, R.modeSql],
  },
  'user-research': {
    key: 'user-research-sprint',
    title: 'Run a User Research Sprint',
    description: 'Plan and run five user interviews, then synthesise what you learned.',
    objective: 'Turn raw interviews into clear, prioritised insights.',
    category: 'SKILL',
    impact: 'SKILL',
    skillSlug: 'user-research',
    skillGain: 35,
    effort: '6 hours',
    xp: 120,
    evidenceRequirement: 'Your interview guide and synthesis board.',
    tasks: [
      'Write a research plan and interview guide',
      'Interview five potential users',
      'Synthesise findings with affinity mapping',
      'Share three key insights and opportunities',
    ],
    resources: [R.nngroup],
  },
  'ab-testing': {
    key: 'experimentation-basics',
    title: 'Experimentation Basics',
    description: 'Understand how to design, size and read an A/B test responsibly.',
    objective: 'Design an experiment with a clear hypothesis, metric and sample size.',
    category: 'SKILL',
    impact: 'SKILL',
    skillSlug: 'ab-testing',
    skillGain: 35,
    effort: '5 hours',
    xp: 100,
    tasks: [
      'Read a practical guide to online controlled experiments',
      'Write a hypothesis and success metric for a feature',
      'Calculate a sample size with an online calculator',
      'Interpret a sample experiment result',
    ],
    resources: [R.svpg],
  },
  'system-design': {
    key: 'system-design-fundamentals',
    title: 'System Design Fundamentals',
    description: 'Learn the building blocks of scalable systems and practise explaining trade-offs.',
    objective: 'Design and explain a URL shortener and a chat system end to end.',
    category: 'SKILL',
    impact: 'SKILL',
    skillSlug: 'system-design',
    skillGain: 40,
    effort: '12 hours',
    xp: 150,
    tasks: [
      'Study load balancing, caching and databases',
      'Design a URL shortener with diagrams',
      'Design a chat system and discuss trade-offs',
      'Explain one design out loud in under 20 minutes',
    ],
    resources: [R.sdPrimer],
  },
  'llm-applications': {
    key: 'build-llm-app',
    title: 'Build an LLM-Powered App',
    description: 'Ship a small application that uses a language model to solve a real problem.',
    objective: 'Deploy a working LLM app with evaluation of its outputs.',
    category: 'PROJECT',
    impact: 'PORTFOLIO',
    skillSlug: 'llm-applications',
    skillGain: 45,
    effort: '15 hours',
    xp: 300,
    evidenceRequirement: 'A GitHub repository or demo link.',
    evidenceRequired: true,
    tasks: [
      'Pick a narrow problem and define success criteria',
      'Build a first version with a hosted or local model',
      'Add retrieval or tool use',
      'Evaluate outputs on 20 test cases',
      'Publish the repository with a README',
    ],
    resources: [R.langflowDocs, R.dlaiShort, R.hfCourse],
  },
  'ux-design': {
    key: 'ux-redesign',
    title: 'Redesign a Real Flow',
    description: 'Pick a frustrating flow in an app you use and redesign it end to end.',
    objective: 'Show your UX process from problem to tested prototype.',
    category: 'PROJECT',
    impact: 'PORTFOLIO',
    skillSlug: 'ux-design',
    skillGain: 40,
    effort: '12 hours',
    xp: 250,
    evidenceRequired: true,
    evidenceRequirement: 'A Figma prototype or case study link.',
    tasks: [
      'Map the current flow and its pain points',
      'Sketch three alternative solutions',
      'Build a clickable prototype',
      'Test with three users and iterate',
    ],
    resources: [R.lawsOfUx, R.nngroup],
  },
};

/** Fallback quest for any skill without a hand-written template. */
export function genericSkillQuest(skillSlug: string): QuestTemplate {
  const skill = SKILL_BY_SLUG.get(skillSlug);
  const name = skill?.name ?? skillSlug;
  return {
    key: `${skillSlug}-foundations`,
    title: `${name} Foundations`,
    description: `Build working knowledge of ${name} and apply it to something real.`,
    objective: `Reach a confident intermediate level in ${name}.`,
    category: 'SKILL',
    impact: 'SKILL',
    skillSlug,
    skillGain: 35,
    effort: '6 hours',
    xp: 100,
    evidenceRequirement: `A short reflection or link showing how you applied ${name}.`,
    tasks: [
      `Pick one trusted learning resource for ${name}`,
      'Complete the core module and take notes',
      `Apply ${name} in a small practice exercise`,
      'Write a short reflection on what you learned',
    ],
    resources: [R.skillsbuild],
  };
}

export function questTemplateForSkill(skillSlug: string): QuestTemplate {
  return SKILL_QUEST_TEMPLATES[skillSlug] ?? genericSkillQuest(skillSlug);
}

// ---------------------------------------------------------------------------
// Shared milestone builders
// ---------------------------------------------------------------------------

function interviewMilestone(roleTitle: string, focus: string[]): MilestoneTemplate {
  return {
    key: 'interview-readiness',
    title: 'Interview Readiness',
    description: `Practise the interviews ${roleTitle} candidates face.`,
    impact: 'INTERVIEW',
    quests: [
      {
        key: 'interview-practice',
        title: `${roleTitle} Interview Practice`,
        description: 'Rehearse realistic questions and learn to structure confident answers.',
        objective: 'Complete two practice sessions and act on the feedback.',
        category: 'INTERVIEW',
        impact: 'INTERVIEW',
        skillSlug: 'communication',
        skillGain: 10,
        effort: '4 hours',
        xp: 100,
        tasks: [
          ...focus,
          'Run a mock interview with Orbit',
          'Write a reflection on what to improve',
        ],
        resources: [R.exponent],
      },
    ],
  };
}

function jobReadyMilestone(roleTitle: string): MilestoneTemplate {
  return {
    key: 'job-ready',
    title: 'Job Ready',
    description: `Package your story and apply to ${roleTitle} roles with confidence.`,
    impact: 'APPLICATION',
    quests: [
      {
        key: 'launch-applications',
        title: 'Launch Your Applications',
        description: 'Turn your progress into strong, targeted applications.',
        objective: 'Submit three tailored applications and follow up.',
        category: 'APPLICATION',
        impact: 'APPLICATION',
        skillGain: 0,
        effort: '5 hours',
        xp: 150,
        tasks: [
          `Tailor your CV for ${roleTitle} roles`,
          'Update LinkedIn and portfolio links',
          'Submit three applications through Orbit',
          'Follow up one week after applying',
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export const ROLES: RoleDefinition[] = [
  {
    slug: 'product-manager',
    title: 'Product Manager',
    family: 'Product Management',
    description:
      'Discovers what users need, decides what to build and aligns teams to ship products that create value.',
    icon: 'compass',
    keywords: ['product manager', 'product management', 'product owner', 'associate product manager', 'apm', 'product intern', 'product analyst'],
    requirements: [
      { skill: 'product-strategy', level: 60, importance: 5 },
      { skill: 'product-analytics', level: 65, importance: 5 },
      { skill: 'communication', level: 70, importance: 5 },
      { skill: 'user-research', level: 60, importance: 4 },
      { skill: 'sql', level: 55, importance: 4 },
      { skill: 'stakeholder-management', level: 55, importance: 4 },
      { skill: 'leadership', level: 60, importance: 4 },
      { skill: 'problem-solving', level: 65, importance: 4 },
      { skill: 'product-discovery', level: 55, importance: 3 },
      { skill: 'roadmapping', level: 50, importance: 3 },
      { skill: 'agile-scrum', level: 50, importance: 3 },
      { skill: 'data-analysis', level: 50, importance: 3 },
      { skill: 'ab-testing', level: 45, importance: 2 },
    ],
    experienceSignals: [
      { id: 'professional', label: 'Professional product experience', types: ['INTERNSHIP', 'WORK'], keywords: ['product', 'growth', 'analytics', 'business', 'pm', 'user'], weight: 0.35 },
      { id: 'project', label: 'Hands-on project delivery', types: ['PROJECT'], keywords: [], weight: 0.25 },
      { id: 'leadership', label: 'Leadership & ownership', types: ['LEADERSHIP', 'ORGANIZATION'], keywords: [], weight: 0.2 },
      { id: 'initiative', label: 'Competitions & initiatives', types: ['COMPETITION', 'RESEARCH', 'VOLUNTEER'], keywords: [], weight: 0.1 },
      { id: 'tenure', label: 'At least 12 months of relevant experience', types: [], keywords: [], weight: 0.1 },
    ],
    journey: [
      {
        key: 'product-foundation',
        title: 'Product Foundation',
        description: 'Think like a product manager: users, problems, outcomes.',
        impact: 'SKILL',
        skillSlug: 'product-strategy',
        quests: [
          {
            key: 'product-thinking',
            title: 'Product Thinking Fundamentals',
            description: 'Learn how strong product teams decide what to build and why.',
            objective: 'Explain a product’s vision, users and success metrics in your own words.',
            category: 'KNOWLEDGE',
            impact: 'SKILL',
            skillSlug: 'product-strategy',
            skillGain: 30,
            effort: '6 hours',
            xp: 100,
            tasks: [
              'Read the first part of “Inspired” by Marty Cagan',
              'Write a product teardown of an app you use daily',
              'Define a product vision statement for that app',
            ],
            resources: [R.svpg],
          },
        ],
      },
      {
        key: 'skill:product-analytics',
        title: 'Product Analytics',
        description: 'Make decisions with data: metrics, funnels and experiments.',
        impact: 'SKILL',
        skillSlug: 'product-analytics',
        quests: [SKILL_QUEST_TEMPLATES['product-analytics'], SKILL_QUEST_TEMPLATES.sql],
      },
      {
        key: 'portfolio',
        title: 'Portfolio',
        description: 'Show, don’t tell: a product case study recruiters can read.',
        impact: 'PORTFOLIO',
        quests: [
          {
            key: 'product-case-study',
            title: 'Build Your First Product Case Study',
            description: 'Build one complete product case from problem to prototype.',
            objective: 'Build one complete product case.',
            category: 'PROJECT',
            impact: 'PORTFOLIO',
            skillSlug: 'product-discovery',
            skillGain: 30,
            effort: '15 hours',
            xp: 300,
            evidenceRequired: true,
            evidenceRequirement: 'A portfolio link or document with your full case study.',
            tasks: [
              'Choose a problem',
              'Conduct research',
              'Define pain point',
              'Design solution',
              'Create prototype',
              'Document case',
            ],
            resources: [R.svpg, R.nngroup],
          },
        ],
      },
      {
        key: 'experience',
        title: 'Experience',
        description: 'Get real product exposure through an internship or project with users.',
        impact: 'EXPERIENCE',
        quests: [
          {
            key: 'practical-product-experience',
            title: 'Gain Practical Product Experience',
            description: 'Find a setting where you can own a product problem with real users.',
            objective: 'Secure a product internship, freelance project or student product role.',
            category: 'EXPERIENCE',
            impact: 'EXPERIENCE',
            skillSlug: 'stakeholder-management',
            skillGain: 20,
            effort: '4 weeks',
            xp: 500,
            evidenceRequirement: 'An offer letter, project brief or reference.',
            tasks: [
              'Shortlist five product internships in Orbit',
              'Tailor your CV for product roles',
              'Apply to three product opportunities',
              'Join a product-focused competition or hackathon',
            ],
          },
        ],
      },
      interviewMilestone('Product Manager', [
        'Practise a product sense question',
        'Practise a metrics and estimation question',
      ]),
      jobReadyMilestone('Product Manager'),
    ],
  },
  {
    slug: 'software-engineer',
    title: 'Software Engineer',
    family: 'Engineering',
    description: 'Designs, builds and maintains reliable software systems that users depend on.',
    icon: 'code',
    keywords: ['software engineer', 'software developer', 'backend', 'frontend', 'full stack', 'fullstack', 'web developer', 'engineer'],
    requirements: [
      { skill: 'dsa', level: 60, importance: 5 },
      { skill: 'javascript', level: 65, importance: 4 },
      { skill: 'typescript', level: 55, importance: 3 },
      { skill: 'git', level: 65, importance: 4 },
      { skill: 'system-design', level: 50, importance: 4 },
      { skill: 'rest-apis', level: 60, importance: 4 },
      { skill: 'databases', level: 55, importance: 4 },
      { skill: 'software-testing', level: 50, importance: 3 },
      { skill: 'react', level: 55, importance: 3 },
      { skill: 'nodejs', level: 55, importance: 3 },
      { skill: 'cloud-devops', level: 40, importance: 2 },
      { skill: 'problem-solving', level: 70, importance: 4 },
      { skill: 'teamwork', level: 60, importance: 3 },
    ],
    experienceSignals: [
      { id: 'professional', label: 'Professional engineering experience', types: ['INTERNSHIP', 'WORK'], keywords: ['engineer', 'developer', 'software', 'backend', 'frontend', 'programmer'], weight: 0.35 },
      { id: 'project', label: 'Shipped software projects', types: ['PROJECT'], keywords: [], weight: 0.3 },
      { id: 'initiative', label: 'Hackathons, open source or competitions', types: ['COMPETITION', 'RESEARCH', 'VOLUNTEER'], keywords: [], weight: 0.15 },
      { id: 'leadership', label: 'Collaboration & leadership', types: ['LEADERSHIP', 'ORGANIZATION'], keywords: [], weight: 0.1 },
      { id: 'tenure', label: 'At least 12 months of relevant experience', types: [], keywords: [], weight: 0.1 },
    ],
    journey: [
      {
        key: 'skill:dsa',
        title: 'Problem Solving Core',
        description: 'Data structures and algorithms for interviews and everyday engineering.',
        impact: 'SKILL',
        skillSlug: 'dsa',
        quests: [
          {
            key: 'dsa-sprint',
            title: 'Algorithms Sprint',
            description: 'Work through the core patterns that appear in most coding interviews.',
            objective: 'Solve 40 problems across 8 core patterns.',
            category: 'SKILL',
            impact: 'SKILL',
            skillSlug: 'dsa',
            skillGain: 40,
            effort: '20 hours',
            xp: 150,
            tasks: ['Arrays, hashing and two pointers', 'Stacks, queues and linked lists', 'Trees and graphs', 'Dynamic programming basics'],
            resources: [R.leetcode],
          },
        ],
      },
      {
        key: 'skill:system-design',
        title: 'System Design',
        description: 'Reason about scale, reliability and trade-offs.',
        impact: 'SKILL',
        skillSlug: 'system-design',
        quests: [SKILL_QUEST_TEMPLATES['system-design']],
      },
      {
        key: 'portfolio',
        title: 'Portfolio',
        description: 'A production-quality project you can walk an interviewer through.',
        impact: 'PORTFOLIO',
        quests: [
          {
            key: 'full-stack-project',
            title: 'Ship a Full-Stack Project',
            description: 'Build and deploy an application with auth, a database and tests.',
            objective: 'Deploy a polished project with a clear README.',
            category: 'PROJECT',
            impact: 'PORTFOLIO',
            skillSlug: 'rest-apis',
            skillGain: 30,
            effort: '25 hours',
            xp: 300,
            evidenceRequired: true,
            evidenceRequirement: 'GitHub repository and live demo link.',
            tasks: ['Define scope and data model', 'Build the API and database', 'Build the front-end', 'Write tests for core flows', 'Deploy and document'],
            resources: [R.roadmapBackend, R.mdn],
          },
        ],
      },
      {
        key: 'experience',
        title: 'Experience',
        description: 'Engineering experience with real users or real codebases.',
        impact: 'EXPERIENCE',
        quests: [
          {
            key: 'engineering-experience',
            title: 'Gain Engineering Experience',
            description: 'Contribute to a real codebase through an internship or open source.',
            objective: 'Merge contributions into a real-world codebase.',
            category: 'EXPERIENCE',
            impact: 'EXPERIENCE',
            skillGain: 0,
            effort: '4 weeks',
            xp: 500,
            tasks: ['Shortlist five engineering internships', 'Make a first open-source contribution', 'Apply to three engineering roles', 'Join a hackathon'],
          },
        ],
      },
      interviewMilestone('Software Engineer', ['Practise two coding interview problems out loud', 'Practise a behavioural question with STAR']),
      jobReadyMilestone('Software Engineer'),
    ],
  },
  {
    slug: 'ai-engineer',
    title: 'AI Engineer',
    family: 'Artificial Intelligence',
    description: 'Builds products powered by machine learning and large language models, from prototype to production.',
    icon: 'brain-circuit',
    keywords: ['ai engineer', 'machine learning engineer', 'ml engineer', 'llm engineer', 'data scientist', 'ai developer', 'generative ai'],
    requirements: [
      { skill: 'python', level: 70, importance: 5 },
      { skill: 'machine-learning', level: 60, importance: 5 },
      { skill: 'llm-applications', level: 60, importance: 5 },
      { skill: 'rag', level: 55, importance: 4 },
      { skill: 'ai-agents', level: 50, importance: 4 },
      { skill: 'deep-learning', level: 50, importance: 3 },
      { skill: 'prompt-engineering', level: 55, importance: 3 },
      { skill: 'statistics', level: 50, importance: 3 },
      { skill: 'mlops', level: 40, importance: 3 },
      { skill: 'rest-apis', level: 50, importance: 3 },
      { skill: 'git', level: 60, importance: 3 },
      { skill: 'problem-solving', level: 70, importance: 4 },
    ],
    experienceSignals: [
      { id: 'professional', label: 'Professional AI/ML experience', types: ['INTERNSHIP', 'WORK', 'RESEARCH'], keywords: ['ai', 'machine learning', 'ml', 'data', 'model', 'llm'], weight: 0.35 },
      { id: 'project', label: 'AI projects shipped', types: ['PROJECT'], keywords: ['ai', 'model', 'machine learning', 'llm', 'prediction', 'classification', 'agent'], weight: 0.3 },
      { id: 'initiative', label: 'Competitions & research', types: ['COMPETITION', 'RESEARCH'], keywords: [], weight: 0.15 },
      { id: 'leadership', label: 'Collaboration & leadership', types: ['LEADERSHIP', 'ORGANIZATION'], keywords: [], weight: 0.1 },
      { id: 'tenure', label: 'At least 12 months of relevant experience', types: [], keywords: [], weight: 0.1 },
    ],
    journey: [
      {
        key: 'skill:machine-learning',
        title: 'ML Foundations',
        description: 'Supervised learning, evaluation and the maths that matters.',
        impact: 'SKILL',
        skillSlug: 'machine-learning',
        quests: [
          {
            key: 'ml-foundations',
            title: 'Machine Learning Foundations',
            description: 'Train, evaluate and explain classic machine learning models.',
            objective: 'Train and evaluate three models on a real dataset.',
            category: 'SKILL',
            impact: 'SKILL',
            skillSlug: 'machine-learning',
            skillGain: 40,
            effort: '15 hours',
            xp: 150,
            tasks: ['Learn train/validation/test and metrics', 'Train a baseline model', 'Tune and compare two models', 'Write up results in a notebook'],
            resources: [R.roadmapAi],
          },
        ],
      },
      {
        key: 'skill:llm-applications',
        title: 'LLM Applications',
        description: 'Prompting, retrieval and agents with modern language models.',
        impact: 'PORTFOLIO',
        skillSlug: 'llm-applications',
        quests: [SKILL_QUEST_TEMPLATES['llm-applications']],
      },
      {
        key: 'portfolio',
        title: 'Portfolio',
        description: 'An end-to-end AI project with evaluation and a clear story.',
        impact: 'PORTFOLIO',
        quests: [
          {
            key: 'agent-project',
            title: 'Ship an AI Agent Project',
            description: 'Build a tool-using agent that completes a real multi-step task.',
            objective: 'Publish an agent with tools, memory and evaluation.',
            category: 'PROJECT',
            impact: 'PORTFOLIO',
            skillSlug: 'ai-agents',
            skillGain: 40,
            effort: '20 hours',
            xp: 300,
            evidenceRequired: true,
            evidenceRequirement: 'GitHub repository or Langflow export with a demo video.',
            tasks: ['Define the task and tools', 'Build the agent flow', 'Add memory and guardrails', 'Evaluate on test scenarios', 'Publish with documentation'],
            resources: [R.langflowDocs, R.dlaiShort],
          },
        ],
      },
      {
        key: 'experience',
        title: 'Experience',
        description: 'Applied AI experience through research, internships or competitions.',
        impact: 'EXPERIENCE',
        quests: [
          {
            key: 'ai-experience',
            title: 'Gain Applied AI Experience',
            description: 'Work on AI problems with real data and real stakeholders.',
            objective: 'Join an AI internship, lab or competition.',
            category: 'EXPERIENCE',
            impact: 'EXPERIENCE',
            skillGain: 0,
            effort: '4 weeks',
            xp: 500,
            tasks: ['Shortlist five AI internships', 'Join an AI hackathon or Kaggle competition', 'Apply to three AI roles', 'Reach out to one research lab'],
          },
        ],
      },
      interviewMilestone('AI Engineer', ['Practise explaining an ML project end to end', 'Practise an ML system design question']),
      jobReadyMilestone('AI Engineer'),
    ],
  },
  {
    slug: 'data-analyst',
    title: 'Data Analyst',
    family: 'Data',
    description: 'Turns raw data into insights and recommendations that guide business decisions.',
    icon: 'chart-no-axes-combined',
    keywords: ['data analyst', 'business analyst', 'bi analyst', 'analytics', 'business intelligence', 'insight analyst'],
    requirements: [
      { skill: 'sql', level: 70, importance: 5 },
      { skill: 'data-analysis', level: 65, importance: 5 },
      { skill: 'data-visualization', level: 60, importance: 4 },
      { skill: 'statistics', level: 55, importance: 4 },
      { skill: 'spreadsheets', level: 60, importance: 4 },
      { skill: 'python', level: 50, importance: 3 },
      { skill: 'communication', level: 65, importance: 4 },
      { skill: 'ab-testing', level: 45, importance: 2 },
      { skill: 'business-strategy', level: 40, importance: 2 },
      { skill: 'problem-solving', level: 65, importance: 4 },
    ],
    experienceSignals: [
      { id: 'professional', label: 'Professional analytics experience', types: ['INTERNSHIP', 'WORK'], keywords: ['data', 'analyst', 'analytics', 'report', 'insight', 'dashboard'], weight: 0.35 },
      { id: 'project', label: 'Analysis projects', types: ['PROJECT', 'RESEARCH'], keywords: [], weight: 0.3 },
      { id: 'initiative', label: 'Competitions & initiatives', types: ['COMPETITION', 'VOLUNTEER'], keywords: [], weight: 0.15 },
      { id: 'leadership', label: 'Collaboration & leadership', types: ['LEADERSHIP', 'ORGANIZATION'], keywords: [], weight: 0.1 },
      { id: 'tenure', label: 'At least 12 months of relevant experience', types: [], keywords: [], weight: 0.1 },
    ],
    journey: [
      {
        key: 'skill:sql',
        title: 'SQL Mastery',
        description: 'Answer any business question with a query.',
        impact: 'SKILL',
        skillSlug: 'sql',
        quests: [SKILL_QUEST_TEMPLATES.sql],
      },
      {
        key: 'skill:data-visualization',
        title: 'Data Storytelling',
        description: 'Dashboards and narratives that drive decisions.',
        impact: 'SKILL',
        skillSlug: 'data-visualization',
        quests: [
          {
            key: 'dashboard-story',
            title: 'Build an Insight Dashboard',
            description: 'Create a dashboard that answers one business question clearly.',
            objective: 'Publish a dashboard with a written recommendation.',
            category: 'PROJECT',
            impact: 'PORTFOLIO',
            skillSlug: 'data-visualization',
            skillGain: 35,
            effort: '10 hours',
            xp: 250,
            evidenceRequired: true,
            evidenceRequirement: 'Link to the published dashboard.',
            tasks: ['Pick a public dataset and a business question', 'Clean and model the data', 'Design the dashboard', 'Write a one-page recommendation'],
            resources: [R.googleDa],
          },
        ],
      },
      {
        key: 'experience',
        title: 'Experience',
        description: 'Analytics work with real stakeholders.',
        impact: 'EXPERIENCE',
        quests: [
          {
            key: 'analytics-experience',
            title: 'Gain Analytics Experience',
            description: 'Analyse data for a real organisation.',
            objective: 'Deliver one analysis to a real stakeholder.',
            category: 'EXPERIENCE',
            impact: 'EXPERIENCE',
            skillGain: 0,
            effort: '4 weeks',
            xp: 500,
            tasks: ['Shortlist five analyst internships', 'Offer an analysis to a student organisation', 'Apply to three analyst roles', 'Join a data competition'],
          },
        ],
      },
      interviewMilestone('Data Analyst', ['Practise a live SQL question', 'Practise presenting an insight in 3 minutes']),
      jobReadyMilestone('Data Analyst'),
    ],
  },
  {
    slug: 'ux-designer',
    title: 'UX Designer',
    family: 'Design',
    description: 'Designs intuitive, accessible experiences grounded in research and iteration.',
    icon: 'pen-tool',
    keywords: ['ux designer', 'ui designer', 'product designer', 'ui/ux', 'interaction designer', 'ux researcher'],
    requirements: [
      { skill: 'ux-design', level: 65, importance: 5 },
      { skill: 'ui-design', level: 60, importance: 4 },
      { skill: 'figma', level: 65, importance: 4 },
      { skill: 'user-research', level: 60, importance: 5 },
      { skill: 'prototyping', level: 60, importance: 4 },
      { skill: 'usability-testing', level: 55, importance: 4 },
      { skill: 'information-architecture', level: 50, importance: 3 },
      { skill: 'design-systems', level: 45, importance: 3 },
      { skill: 'communication', level: 65, importance: 4 },
      { skill: 'teamwork', level: 60, importance: 3 },
    ],
    experienceSignals: [
      { id: 'professional', label: 'Professional design experience', types: ['INTERNSHIP', 'WORK'], keywords: ['design', 'ux', 'ui', 'product'], weight: 0.35 },
      { id: 'project', label: 'Design case studies', types: ['PROJECT'], keywords: ['design', 'ux', 'ui', 'prototype', 'figma', 'app'], weight: 0.3 },
      { id: 'initiative', label: 'Design competitions', types: ['COMPETITION', 'VOLUNTEER'], keywords: [], weight: 0.15 },
      { id: 'leadership', label: 'Collaboration & leadership', types: ['LEADERSHIP', 'ORGANIZATION'], keywords: [], weight: 0.1 },
      { id: 'tenure', label: 'At least 12 months of relevant experience', types: [], keywords: [], weight: 0.1 },
    ],
    journey: [
      {
        key: 'skill:user-research',
        title: 'Research Foundations',
        description: 'Design from evidence, not assumptions.',
        impact: 'SKILL',
        skillSlug: 'user-research',
        quests: [SKILL_QUEST_TEMPLATES['user-research']],
      },
      {
        key: 'portfolio',
        title: 'Portfolio',
        description: 'Two case studies that show your process end to end.',
        impact: 'PORTFOLIO',
        quests: [SKILL_QUEST_TEMPLATES['ux-design']],
      },
      {
        key: 'experience',
        title: 'Experience',
        description: 'Design for real users and real teams.',
        impact: 'EXPERIENCE',
        quests: [
          {
            key: 'design-experience',
            title: 'Gain Design Experience',
            description: 'Work with a real team on a real product.',
            objective: 'Ship a design used by real people.',
            category: 'EXPERIENCE',
            impact: 'EXPERIENCE',
            skillGain: 0,
            effort: '4 weeks',
            xp: 500,
            tasks: ['Shortlist five design internships', 'Volunteer design work for a non-profit', 'Apply to three design roles', 'Enter a UI/UX competition'],
          },
        ],
      },
      interviewMilestone('UX Designer', ['Practise presenting a case study', 'Practise a whiteboard design challenge']),
      jobReadyMilestone('UX Designer'),
    ],
  },
];

export const ROLE_BY_SLUG = new Map(ROLES.map((r) => [r.slug, r]));

/** Map onboarding interests to candidate role slugs. */
export const INTEREST_TO_ROLE: Record<string, string> = {
  'Product Management': 'product-manager',
  'Software Engineering': 'software-engineer',
  'AI / Machine Learning': 'ai-engineer',
  Data: 'data-analyst',
  'UI/UX': 'ux-designer',
  Business: 'product-manager',
  Consulting: 'data-analyst',
};
