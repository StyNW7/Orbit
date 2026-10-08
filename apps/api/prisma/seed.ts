/**
 * Orbit seed — catalog, curated content and a coherent golden-demo account.
 *
 *   pnpm db:seed
 *
 * Idempotent: catalog/content are upserted; the demo account is rebuilt.
 */
import '../src/load-env';
import 'reflect-metadata';
process.env.ORBIT_DISABLE_SCHEDULER = 'true';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from '../src/app.module';
import { SKILLS } from '../src/catalog/skills.catalog';
import { ROLES } from '../src/catalog/roles.catalog';
import { CURATED_BOOKS, CURATED_EVENTS, CURATED_PAPERS, CURATED_PEOPLE, CURATED_RESOURCES } from '../src/catalog/seed-content';
import { JobsService } from '../src/modules/opportunities/jobs.service';
import { CuratedJobProvider } from '../src/modules/opportunities/job-providers';
import { RecommendationService } from '../src/modules/recommendations/recommendation.service';
import { JourneysService } from '../src/modules/journeys/journeys.service';
import { CareerContextService } from '../src/modules/career/career-context.service';
import { ReadinessService } from '../src/modules/career/readiness.service';
import { SyncService } from '../src/modules/graph/graph.module';
import { NotesService } from '../src/modules/notes/notes.module';
import { titleKey } from '../src/modules/discover/knowledge-providers';
import { DEMO_EMAIL } from '../src/modules/auth/auth.module';

const log = new Logger('Seed');
const prisma = new PrismaClient();
const DEMO_PASSWORD = 'OrbitDemo2026!';
const DAY = 86_400_000;
const daysAgo = (n: number, hour = 10) => {
  const d = new Date(Date.now() - n * DAY);
  d.setHours(hour, (n * 7) % 60, 0, 0);
  return d;
};
const at = (y: number, m: number) => new Date(Date.UTC(y, m - 1, 1));

async function seedCatalog() {
  for (const s of SKILLS) {
    await prisma.skill.upsert({
      where: { slug: s.slug },
      update: { name: s.name, category: s.category, description: s.description, aliases: s.aliases },
      create: { slug: s.slug, name: s.name, category: s.category, description: s.description, aliases: s.aliases },
    });
  }
  const skillIds = new Map((await prisma.skill.findMany()).map((s) => [s.slug, s.id]));
  for (const r of ROLES) {
    const role = await prisma.careerRole.upsert({
      where: { slug: r.slug },
      update: { title: r.title, family: r.family, description: r.description, icon: r.icon, keywords: r.keywords, experienceSignals: r.experienceSignals as unknown as Prisma.InputJsonValue, journeyTemplate: r.journey as unknown as Prisma.InputJsonValue },
      create: { slug: r.slug, title: r.title, family: r.family, description: r.description, icon: r.icon, keywords: r.keywords, experienceSignals: r.experienceSignals as unknown as Prisma.InputJsonValue, journeyTemplate: r.journey as unknown as Prisma.InputJsonValue },
    });
    await prisma.roleSkillRequirement.deleteMany({ where: { roleId: role.id } });
    await prisma.roleSkillRequirement.createMany({
      data: r.requirements.map((q) => ({ roleId: role.id, skillId: skillIds.get(q.skill)!, requiredLevel: q.level, importance: q.importance })),
    });
  }
  log.log(`Catalog: ${SKILLS.length} skills, ${ROLES.length} career roles`);
}

async function seedContent(recs: RecommendationService, jobs: JobsService) {
  const imported = await jobs.ingest(await new CuratedJobProvider().fetch());
  log.log(`Jobs: ${imported} new curated listings`);

  for (const b of CURATED_BOOKS) {
    const dedupeKey = titleKey(b.title, b.authors[0]);
    const data = { source: 'curated', externalId: b.key, title: b.title, authors: b.authors, description: b.description, publishedYear: b.year, level: b.level, infoUrl: b.infoUrl, skills: b.skills, roleSlugs: b.roles };
    const row = await prisma.book.upsert({ where: { dedupeKey }, update: data, create: { ...data, dedupeKey } });
    await recs.storeEmbedding('Book', row.id, `${b.title}. ${b.description}. Skills: ${b.skills.join(', ')}`);
  }
  for (const p of CURATED_PAPERS) {
    const dedupeKey = titleKey(p.title, String(p.year));
    const data = { source: 'curated', externalId: p.key, title: p.title, authors: p.authors, year: p.year, venue: p.venue, abstract: p.summary, url: p.url, doi: p.doi, skills: p.skills, roleSlugs: p.roles };
    const row = await prisma.researchPaper.upsert({ where: { dedupeKey }, update: data, create: { ...data, dedupeKey } });
    await recs.storeEmbedding('ResearchPaper', row.id, `${p.title}. ${p.summary}. Skills: ${p.skills.join(', ')}`);
  }
  for (const e of CURATED_EVENTS) {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + e.inDays);
    start.setUTCHours(e.hourWib - 7, 0, 0, 0); // WIB = UTC+7
    const data = {
      source: 'curated',
      title: e.title,
      type: e.type,
      organizer: e.organizer,
      description: e.description,
      startsAt: start,
      endsAt: new Date(start.getTime() + e.durationHours * 3_600_000),
      registrationDeadline: e.registrationInDays ? new Date(Date.now() + e.registrationInDays * DAY) : null,
      location: e.location,
      isOnline: e.isOnline,
      url: null,
      cost: e.cost,
      skills: e.skills,
      roleSlugs: e.roles,
      isDemo: true,
    };
    const row = await prisma.event.upsert({ where: { dedupeKey: `curated:${e.key}` }, update: data, create: { ...data, dedupeKey: `curated:${e.key}` } });
    await recs.storeEmbedding('Event', row.id, `${e.title}. ${e.description}. Skills: ${e.skills.join(', ')}`);
  }
  for (const r of CURATED_RESOURCES) {
    const data = { source: 'curated', title: r.title, type: r.type, provider: r.provider, description: r.description, url: r.url, durationHours: r.durationHours, level: r.level, cost: r.cost, skills: r.skills, roleSlugs: r.roles };
    const row = await prisma.resource.upsert({ where: { dedupeKey: `curated:${r.key}` }, update: data, create: { ...data, dedupeKey: `curated:${r.key}` } });
    await recs.storeEmbedding('Resource', row.id, `${r.title}. ${r.description}. Skills: ${r.skills.join(', ')}`);
  }
  for (const p of CURATED_PEOPLE) {
    const data = {
      kind: p.kind,
      name: p.name,
      headline: p.headline,
      careerSummary: p.careerSummary,
      publicSources: p.publicSources,
      skills: p.skills,
      expertise: p.expertise,
      careerTransitions: p.careerTransitions,
      relatedRoleSlugs: p.relatedRoleSlugs,
      earlyCareerSignals: p.earlyCareerSignals,
      location: p.location,
      availability: p.availability,
      isDemo: p.isDemo,
    };
    const row = await prisma.roleModel.upsert({ where: { slug: p.slug }, update: data, create: { ...data, slug: p.slug } });
    await recs.storeEmbedding('RoleModel', row.id, `${p.name}. ${p.headline}. ${p.careerSummary}. Skills: ${p.skills.join(', ')}`);
  }
  log.log(`Content: ${CURATED_BOOKS.length} books, ${CURATED_PAPERS.length} papers, ${CURATED_EVENTS.length} events, ${CURATED_RESOURCES.length} resources, ${CURATED_PEOPLE.length} people`);
}

async function demoUserId(): Promise<{ id: string; provider: 'LOCAL' | 'SUPABASE' }> {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && serviceKey) {
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = list?.users.find((u) => u.email === DEMO_EMAIL);
    if (existing) return { id: existing.id, provider: 'SUPABASE' };
    const { data, error } = await admin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { name: 'Raka Pratama' },
    });
    if (error || !data.user) throw new Error(`Could not create Supabase demo user: ${error?.message}`);
    return { id: data.user.id, provider: 'SUPABASE' };
  }
  return { id: crypto.randomUUID(), provider: 'LOCAL' };
}

async function seedDemoUser(app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>>) {
  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });
  const { id, provider } = await demoUserId();
  const cvText = readFileSync(resolve(__dirname, '../../../docs/demo/sample-cv.txt'), 'utf8');
  const skills = new Map((await prisma.skill.findMany()).map((s) => [s.slug, s.id]));
  const roles = new Map((await prisma.careerRole.findMany()).map((r) => [r.slug, r.id]));

  const user = await prisma.user.create({
    data: {
      id,
      email: DEMO_EMAIL,
      name: 'Raka Pratama',
      authProvider: provider,
      passwordHash: provider === 'LOCAL' ? await bcrypt.hash(DEMO_PASSWORD, 10) : null,
      createdAt: daysAgo(150),
      lastActiveAt: new Date(),
    },
  });
  const userId = user.id;

  await prisma.careerProfile.create({
    data: {
      userId,
      headline: 'Computer Science student building toward Product Management',
      summary:
        'Computer Science student who enjoys turning messy problems into products people use. Led a 12-person technology division, shipped a campus event app used by 1,200 students, and reached the finals of a national hackathon.',
      currentStatus: 'Computer Science Student',
      university: 'Bina Nusantara University',
      major: 'Computer Science',
      graduationYear: 2027,
      location: 'Jakarta, Indonesia',
      interests: ['Product Management', 'AI / Machine Learning', 'Software Engineering'],
      preferredIndustries: ['Fintech', 'EdTech', 'E-commerce'],
      preferredWorkModes: ['HYBRID', 'REMOTE'],
      preferredLocations: ['Jakarta'],
      preferredRoleTypes: ['INTERNSHIP', 'GRADUATE_PROGRAM'],
      additionalContext: 'I want to become a Product Manager. I enjoy talking to users and leading teams, but I still need to get better with data.',
      linkedinUrl: 'https://linkedin.com/in/raka-pratama-demo',
      githubUrl: 'https://github.com/raka-pratama-demo',
      cvText,
      cvParsedAt: daysAgo(150),
      extractionSource: 'HEURISTIC',
      onboardingCompleted: true,
      createdAt: daysAgo(150),
    },
  });

  await prisma.education.create({
    data: { userId, institution: 'Bina Nusantara University', degree: 'Bachelor of Computer Science', field: 'Computer Science', startDate: at(2023, 8), endDate: at(2027, 7), gpa: '3.72 / 4.00' },
  });
  await prisma.experience.createMany({
    data: [
      {
        userId,
        type: 'LEADERSHIP',
        title: 'Head of Technology Division',
        organization: 'Computer Science Student Association',
        description: 'Led a team of 12 developers and designers maintaining the association event platform. Coordinated with 5 divisions to plan a quarterly roadmap and prioritize requests. Organized 4 tech workshops for 300+ students.',
        startDate: at(2024, 9),
        current: true,
        skills: ['Leadership', 'Roadmapping & Prioritization', 'Public Speaking'],
      },
      {
        userId,
        type: 'PROJECT',
        title: 'Campus Event App',
        organization: 'Team Lead and Full-Stack Developer',
        description: 'Built a React and Node.js app with PostgreSQL used by 1,200 students. Interviewed 15 students to understand pain points and prioritized the backlog. Shipped 3 iterations in agile sprints.',
        startDate: at(2025, 2),
        endDate: at(2025, 6),
        skills: ['React', 'Node.js', 'User Research', 'Agile & Scrum'],
      },
      {
        userId,
        type: 'WORK',
        title: 'Teaching Assistant, Algorithm and Programming',
        organization: 'Bina Nusantara University',
        description: 'Mentored 40 first-year students in weekly lab sessions; explained concepts and gave structured feedback.',
        startDate: at(2025, 2),
        endDate: at(2026, 1),
        skills: ['Communication', 'Data Structures & Algorithms'],
      },
      {
        userId,
        type: 'COMPETITION',
        title: 'Finalist — National Student Hackathon 2025',
        organization: 'Nusantara Tech Community',
        description: 'Built a payment-reminder prototype for small merchants in 36 hours and pitched it to industry judges.',
        startDate: at(2025, 10),
        endDate: at(2025, 10),
        skills: ['Prototyping', 'Public Speaking', 'Problem Solving'],
      },
    ],
  });
  await prisma.achievement.createMany({
    data: [
      { userId, type: 'AWARD', title: 'Finalist — National Student Hackathon 2025', issuer: 'Nusantara Tech Community', date: at(2025, 10) },
      { userId, type: 'CERTIFICATION', title: 'Artificial Intelligence Fundamentals', issuer: 'IBM SkillsBuild', date: at(2026, 3) },
    ],
  });

  const levels: Record<string, number> = {
    leadership: 76, teamwork: 78, communication: 70, 'public-speaking': 62, 'problem-solving': 70, javascript: 70, react: 66,
    nodejs: 58, typescript: 52, python: 55, git: 68, 'rest-apis': 56, databases: 46, dsa: 62, 'project-management': 56,
    'stakeholder-management': 50, 'agile-scrum': 56, 'user-research': 42, 'product-strategy': 34, 'product-discovery': 38,
    roadmapping: 36, 'data-analysis': 38, sql: 30, 'product-analytics': 12, figma: 45, 'ux-design': 40, 'machine-learning': 28,
  };
  await prisma.userSkill.createMany({
    data: Object.entries(levels).map(([slug, level]) => ({ userId, skillId: skills.get(slug)!, level, source: 'CV' as const, createdAt: daysAgo(150) })),
  });

  await prisma.careerGoal.create({ data: { userId, roleId: roles.get('product-manager')!, isPrimary: true, motivation: 'I want to become a Product Manager.', createdAt: daysAgo(150) } });
  await prisma.careerGoal.create({ data: { userId, roleId: roles.get('software-engineer')!, createdAt: daysAgo(120) } });
  await prisma.careerGoal.create({ data: { userId, roleId: roles.get('ai-engineer')!, createdAt: daysAgo(60) } });

  // ---- Journey: full template except Product Analytics (left for the golden demo "Add to Journey") ----
  const journeys = app.get(JourneysService);
  await journeys.build(userId);
  const journey = await prisma.careerJourney.findFirstOrThrow({ where: { userId } });
  await prisma.careerJourney.update({ where: { id: journey.id }, data: { createdAt: daysAgo(140), lastProgressAt: daysAgo(0, 9) } });
  await prisma.milestone.deleteMany({ where: { journeyId: journey.id, key: 'skill:product-analytics' } });
  // History below is written explicitly with past dates.
  await prisma.activityLog.deleteMany({ where: { userId } });
  await prisma.readinessSnapshot.deleteMany({ where: { userId } });
  await prisma.user.update({ where: { id: userId }, data: { xp: 0 } });

  const quest = (key: string) => prisma.quest.findFirstOrThrow({ where: { userId, key }, include: { tasks: { orderBy: { order: 'asc' } } } });
  // Product Thinking Fundamentals — completed ~3 months ago
  const thinking = await quest('product-thinking');
  for (const [i, t] of thinking.tasks.entries()) await prisma.questTask.update({ where: { id: t.id }, data: { completed: true, completedAt: daysAgo(100 - i * 4) } });
  await prisma.quest.update({ where: { id: thinking.id }, data: { status: 'COMPLETED', progress: 100, completedAt: daysAgo(92) } });
  await prisma.questProgress.create({ data: { questId: thinking.id, userId, progressBefore: 67, progressAfter: 100, note: 'Quest completed', createdAt: daysAgo(92) } });
  // Product case study — 4 of 6 tasks, recent daily progress (streak)
  const caseStudy = await quest('product-case-study');
  const doneDays = [12, 6, 3, 1];
  for (const [i, t] of caseStudy.tasks.slice(0, 4).entries()) {
    await prisma.questTask.update({ where: { id: t.id }, data: { completed: true, completedAt: daysAgo(doneDays[i], 20) } });
    await prisma.questProgress.create({ data: { questId: caseStudy.id, userId, taskId: t.id, progressBefore: Math.round((i / 6) * 100), progressAfter: Math.round(((i + 1) / 6) * 100), createdAt: daysAgo(doneDays[i], 20) } });
  }
  await prisma.quest.update({ where: { id: caseStudy.id }, data: { status: 'IN_PROGRESS', progress: 67, deadline: new Date(Date.now() + 9 * DAY) } });
  await prisma.questEvidence.create({
    data: { questId: caseStudy.id, userId, type: 'TEXT', text: 'Research summary: interviewed 6 small merchants about payment reminders; top pain point is chasing late payments over chat.', aiReview: null, reviewStatus: 'SKIPPED', createdAt: daysAgo(3, 21) },
  });
  // Experience quest — first task done
  const exp = await quest('practical-product-experience');
  await prisma.questTask.update({ where: { id: exp.tasks[0].id }, data: { completed: true, completedAt: daysAgo(10) } });
  await prisma.quest.update({ where: { id: exp.id }, data: { status: 'IN_PROGRESS', progress: 25 } });
  for (const m of await prisma.milestone.findMany({ where: { journeyId: journey.id } })) await journeys.refreshMilestone(m.id);
  const foundation = await prisma.milestone.findFirst({ where: { journeyId: journey.id, key: 'product-foundation' } });
  if (foundation) await prisma.milestone.update({ where: { id: foundation.id }, data: { completedAt: daysAgo(92) } });

  // ---- Applications ----
  const opp = (externalId: string) => prisma.opportunity.findFirstOrThrow({ where: { source: 'curated', externalId } });
  const apm = await opp('kl-apm');
  const growth = await opp('sh-growth-intern');
  const checklist = (done: number) =>
    ['Tailor your CV to the role', 'Research the company and product', 'Prepare three STAR stories', 'Write a short cover note', 'Practise interview questions in Orbit'].map((label, i) => ({ id: crypto.randomUUID(), label, done: i < done }));
  await prisma.application.create({
    data: {
      userId,
      opportunityId: apm.id,
      status: 'APPLIED',
      matchScore: 74,
      deadline: apm.deadline,
      appliedAt: daysAgo(9),
      prepChecklist: checklist(4),
      statusHistory: [
        { status: 'SAVED', at: daysAgo(14).toISOString() },
        { status: 'PREPARING', at: daysAgo(12).toISOString() },
        { status: 'APPLIED', at: daysAgo(9).toISOString() },
      ],
      createdAt: daysAgo(14),
    },
  });
  const growthApp = await prisma.application.create({
    data: {
      userId,
      opportunityId: growth.id,
      status: 'INTERVIEW',
      matchScore: 79,
      deadline: growth.deadline,
      appliedAt: daysAgo(11),
      prepChecklist: checklist(5),
      notes: 'First round with the growth lead went well. They asked a lot about activation metrics.',
      statusHistory: [
        { status: 'SAVED', at: daysAgo(16).toISOString() },
        { status: 'APPLIED', at: daysAgo(11).toISOString() },
        { status: 'INTERVIEW', at: daysAgo(5).toISOString() },
      ],
      createdAt: daysAgo(16),
    },
  });
  for (const o of [apm, growth]) await prisma.savedOpportunity.create({ data: { userId, kind: 'OPPORTUNITY', opportunityId: o.id, createdAt: daysAgo(15) } });
  await prisma.interviewSession.create({
    data: {
      userId,
      applicationId: growthApp.id,
      roleTitle: 'Growth Product Intern',
      company: 'Sehatku Health',
      status: 'COMPLETED',
      generatedBy: 'TEMPLATE',
      questions: [
        { id: crypto.randomUUID(), question: 'Tell me about a time you led a team through a difficult situation. What was the result?', focus: 'Leadership', answer: 'As head of the technology division I led 12 people through a platform outage before our biggest event. First I split the team into fixing and communicating, then we shipped a fix in 6 hours and the event served 300 students without issues.', feedback: 'Clear structure and a concrete result. Add what you would do differently next time.' },
        { id: crypto.randomUUID(), question: 'Daily active users dropped 10% last week. Walk me through how you would investigate.', focus: 'Product analytics', answer: 'I think I would maybe check if something broke, and then ask the team. I am not sure which metrics I would look at first.', feedback: 'Structure the answer: check data quality, segment by platform and cohort, then form hypotheses. Replace hedging phrases with clear statements.' },
      ],
      scores: { communication: 68, structure: 61, roleKnowledge: 46, examples: 58, confidence: 63 },
      summary: 'You answered 2 of 2 questions. Strongest area: communication. Focus next on role knowledge. These are coaching indicators, not exact measurements.',
      createdAt: daysAgo(3, 19),
      completedAt: daysAgo(3, 19),
    },
  });

  // ---- Knowledge progress ----
  const inspired = await prisma.book.findFirstOrThrow({ where: { externalId: 'inspired' } });
  const skillsbuild = await prisma.resource.findFirstOrThrow({ where: { dedupeKey: 'curated:ibm-skillsbuild' } });
  const modeSql = await prisma.resource.findFirstOrThrow({ where: { dedupeKey: 'curated:mode-sql' } });
  await prisma.savedOpportunity.createMany({
    data: [
      { userId, kind: 'BOOK', bookId: inspired.id, status: 'COMPLETED', completedAt: daysAgo(75), createdAt: daysAgo(110) },
      { userId, kind: 'RESOURCE', resourceId: skillsbuild.id, status: 'COMPLETED', completedAt: daysAgo(40), createdAt: daysAgo(60) },
      { userId, kind: 'RESOURCE', resourceId: modeSql.id, status: 'IN_PROGRESS', createdAt: daysAgo(8) },
    ],
  });

  // ---- Career journal (three notes share a recurring difficulty: product metrics) ----
  await prisma.careerNote.createMany({
    data: [
      { userId, type: 'INTERVIEW_REFLECTION', title: 'Sehatku first-round interview', content: 'The conversation about my campus app went well. I struggled when they asked which product metrics I would track for activation — I did not know how to choose between DAU and week-one retention.', tags: ['Sehatku Health', 'interview'], createdAt: daysAgo(5, 21) },
      { userId, type: 'LEARNING_REFLECTION', title: 'Case study: defining success', content: 'Research for the merchant case study is done. Defining product metrics for the solution was difficult; I am unsure which north star metric fits a payment-reminder product.', tags: ['case study'], createdAt: daysAgo(3, 22) },
      { userId, type: 'CAREER_THOUGHT', title: 'Talking with a PM at the meetup', content: 'A senior PM said most junior candidates feel unsure about product metrics. I realised I am weak at this too, even though I am comfortable leading teams and talking to users.', tags: ['networking'], createdAt: daysAgo(2, 20) },
      { userId, type: 'EXPERIENCE_UPDATE', title: 'TA final week', content: 'Wrapped up the teaching assistant role. Explaining algorithms every week made me much more confident presenting to groups.', tags: ['teaching'], createdAt: daysAgo(30, 18) },
    ],
  });
  await app.get(NotesService).refreshPatterns(userId);

  // ---- Activity history (timeline, XP, streak) ----
  const activity: { type: Prisma.ActivityLogCreateManyInput['type']; title: string; description?: string; xp: number; at: Date }[] = [
    { type: 'PROFILE_ANALYZED', title: 'Built Career Intelligence', xp: 50, at: daysAgo(150) },
    { type: 'GOAL_SET', title: 'Set Product Manager as primary career goal', xp: 0, at: daysAgo(150) },
    { type: 'JOURNEY_STARTED', title: 'Started Product Manager Journey', xp: 0, at: daysAgo(140) },
    { type: 'TASK_COMPLETED', title: 'Read the first part of “Inspired”', xp: 10, at: daysAgo(100) },
    { type: 'QUEST_COMPLETED', title: 'Completed Product Thinking Fundamentals', xp: 100, at: daysAgo(92) },
    { type: 'MILESTONE_COMPLETED', title: 'Milestone reached: Product Foundation', xp: 150, at: daysAgo(92) },
    { type: 'RESOURCE_COMPLETED', title: 'Completed “Inspired”', xp: 40, at: daysAgo(75) },
    { type: 'READINESS_MILESTONE', title: 'Product Manager readiness reached 60%', xp: 0, at: daysAgo(70) },
    { type: 'RESOURCE_COMPLETED', title: 'Earned IBM SkillsBuild AI Fundamentals', xp: 40, at: daysAgo(40) },
    { type: 'READINESS_MILESTONE', title: 'Product Manager readiness reached 70%', xp: 0, at: daysAgo(25) },
    { type: 'APPLICATION_UPDATED', title: 'Applied to Growth Product Intern', description: 'Sehatku Health', xp: 50, at: daysAgo(11) },
    { type: 'TASK_COMPLETED', title: 'Choose a problem', description: 'Build Your First Product Case Study', xp: 10, at: daysAgo(12, 20) },
    { type: 'APPLICATION_UPDATED', title: 'Applied to Associate Product Manager', description: 'Kopiloka', xp: 50, at: daysAgo(9) },
    { type: 'TASK_COMPLETED', title: 'Conduct research', description: 'Build Your First Product Case Study', xp: 10, at: daysAgo(6, 20) },
    { type: 'APPLICATION_UPDATED', title: 'Interviewing for Growth Product Intern', description: 'Sehatku Health', xp: 50, at: daysAgo(5) },
    { type: 'NOTE_WRITTEN', title: 'Sehatku first-round interview', xp: 5, at: daysAgo(5, 21) },
    { type: 'NOTE_WRITTEN', title: 'Talking with a PM at the meetup', xp: 5, at: daysAgo(4, 20) },
    { type: 'TASK_COMPLETED', title: 'Define pain point', description: 'Build Your First Product Case Study', xp: 10, at: daysAgo(3, 20) },
    { type: 'INTERVIEW_PRACTICED', title: 'Interview practice: Growth Product Intern', description: 'Sehatku Health', xp: 100, at: daysAgo(3, 19) },
    { type: 'NOTE_WRITTEN', title: 'Case study: defining success', xp: 5, at: daysAgo(2, 22) },
    { type: 'TASK_COMPLETED', title: 'Design solution', description: 'Build Your First Product Case Study', xp: 10, at: daysAgo(1, 20) },
  ];
  await prisma.activityLog.createMany({ data: activity.map((a) => ({ userId, type: a.type, title: a.title, description: a.description, xp: a.xp, createdAt: a.at })) });
  await prisma.user.update({ where: { id: userId }, data: { xp: activity.reduce((s, a) => s + a.xp, 0) + 120 } });

  // ---- Readiness history leading up to today's deterministic score ----
  const ctx = await app.get(CareerContextService).load(userId);
  const current = app.get(ReadinessService).computeFor(ctx, ctx.primaryGoal!);
  const factors = [0.68, 0.72, 0.77, 0.8, 0.84, 0.87, 0.9, 0.93, 0.96, 0.98];
  const spanDays = [148, 130, 112, 95, 78, 62, 45, 30, 16, 6];
  await prisma.readinessSnapshot.createMany({
    data: factors.map((f, i) => ({
      userId,
      goalId: ctx.primaryGoal!.id,
      roleSlug: 'product-manager',
      score: Math.round(current.score * f * 10) / 10,
      breakdown: Object.fromEntries(current.breakdown.map((b) => [b.category, Math.round(b.score * (f + (1 - f) * (b.category === 'SKILL' ? 0.2 : 0.6)))])),
      trigger: 'history',
      createdAt: daysAgo(spanDays[i]),
    })),
  });

  // ---- Notifications ----
  await prisma.notification.createMany({
    data: [
      { userId, type: 'APPLICATION_FOLLOW_UP', title: 'Follow up with Kopiloka', message: 'It has been over a week since you applied for Associate Product Manager. A short follow-up can help.', actionUrl: '/app/discover/applications', status: 'DELIVERED', deliveredAt: daysAgo(1, 9), scheduledAt: daysAgo(1, 9), dedupeKey: 'seed-followup-kopiloka' },
      { userId, type: 'WEEKLY_REVIEW', title: 'Your weekly career review', message: 'Readiness moved up this week. Pick this week’s focus in Mission Control.', actionUrl: '/app/progress', status: 'READ', readAt: daysAgo(3), deliveredAt: daysAgo(4, 8), scheduledAt: daysAgo(4, 8), dedupeKey: 'seed-weekly' },
    ],
  });

  await app.get(SyncService).afterChange(userId, 'seed', { recommendations: true });
  log.log(`Demo account ready: ${DEMO_EMAIL} / ${DEMO_PASSWORD} — ${ctx.primaryGoal!.role.title} readiness ${current.score}%`);
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    await seedCatalog();
    await seedContent(app.get(RecommendationService), app.get(JobsService));
    await seedDemoUser(app);
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
