import { Body, Controller, Delete, Get, Injectable, Module, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApplicationStatus, type Application, type Opportunity, type Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import { randomUUID } from 'node:crypto';
import { format } from 'date-fns';
import { z } from 'zod';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  XP_REWARDS,
  type ApplicationDetail,
  type ApplicationView,
  type InterviewQuestion,
  type InterviewScores,
  type InterviewSessionView,
  type PrepChecklistItem,
} from '@orbit/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { badRequest, notFound } from '../../common/http/errors';
import { toNoteView, toOpportunityView } from '../../common/mappers';
import { CurrentUser, type AuthUser } from '../../common/auth/auth.decorators';
import { SKILL_BY_SLUG } from '../../catalog/skills.catalog';
import { ROLE_BY_SLUG } from '../../catalog/roles.catalog';
import { AiService } from '../ai/ai.service';
import { CareerContextService } from '../career/career-context.service';
import { prepProgress } from '../career/readiness.service';
import { DiscoverService } from '../discover/discover.service';
import { SyncService } from '../graph/graph.module';
import { NotificationsService } from '../notifications/notifications.module';
import { UsersService } from '../users/users.service';
import { averageScores, feedbackFor, scoreAnswer, templateQuestions, weakestDimension } from './interview.engine';

const DEFAULT_CHECKLIST = [
  'Tailor your CV to the role',
  'Research the company and product',
  'Prepare three STAR stories',
  'Write a short cover note',
  'Practise interview questions in Orbit',
];

type AppWithOpp = Application & { opportunity: Opportunity; _count?: { interviews: number } };

function checklist(raw: unknown): PrepChecklistItem[] {
  return Array.isArray(raw) ? (raw as PrepChecklistItem[]) : [];
}

function nextAction(a: AppWithOpp): string {
  const items = checklist(a.prepChecklist);
  switch (a.status) {
    case 'SAVED':
      return 'Start preparing: tailor your CV to this role';
    case 'PREPARING': {
      const open = items.find((i) => !i.done);
      return open ? open.label : 'Submit your application';
    }
    case 'APPLIED':
      return a.appliedAt && Date.now() - a.appliedAt.getTime() > 7 * 86_400_000 ? 'Send a polite follow-up' : 'Prepare for the assessment stage';
    case 'ASSESSMENT':
      return 'Practise role knowledge questions';
    case 'INTERVIEW':
      return 'Run a mock interview for this role';
    case 'OFFER':
      return 'Review the offer and decide';
    case 'REJECTED':
      return 'Capture lessons learned in your journal';
    default:
      return 'No action needed';
  }
}

const InterviewQuestionsSchema = z.object({
  questions: z.array(z.object({ question: z.string().min(10).max(400), focus: z.string().min(2).max(60) })).min(3).max(6),
});

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly discover: DiscoverService,
    private readonly notifications: NotificationsService,
    private readonly users: UsersService,
    private readonly sync: SyncService,
    private readonly context: CareerContextService,
    private readonly ai: AiService,
  ) {}

  toView(a: AppWithOpp): ApplicationView {
    const items = checklist(a.prepChecklist);
    return {
      id: a.id,
      status: a.status,
      opportunity: { ...toOpportunityView(a.opportunity), skills: a.opportunity.skills.map((s) => SKILL_BY_SLUG.get(s)?.name ?? s) },
      matchScore: a.matchScore,
      deadline: a.deadline?.toISOString() ?? null,
      appliedAt: a.appliedAt?.toISOString() ?? null,
      notes: a.notes,
      nextAction: nextAction(a),
      prepChecklist: items,
      prepProgress: prepProgress(items),
      statusHistory: Array.isArray(a.statusHistory) ? (a.statusHistory as ApplicationView['statusHistory']) : [],
      interviewCount: a._count?.interviews ?? 0,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  }

  async list(userId: string): Promise<ApplicationView[]> {
    const apps = await this.prisma.application.findMany({
      where: { userId },
      include: { opportunity: true, _count: { select: { interviews: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    return apps.map((a) => this.toView(a));
  }

  /** Save a job: creates the application, detects its deadline and schedules a reminder. */
  async create(userId: string, opportunityId: string): Promise<ApplicationView & { reminderScheduledAt: string | null }> {
    const existing = await this.prisma.application.findUnique({
      where: { userId_opportunityId: { userId, opportunityId } },
      include: { opportunity: true, _count: { select: { interviews: true } } },
    });
    if (existing) return { ...this.toView(existing), reminderScheduledAt: null };
    const job = await this.discover.job(userId, opportunityId);
    const opportunity = await this.prisma.opportunity.findUniqueOrThrow({ where: { id: opportunityId } });
    const deadline = opportunity.deadline ?? opportunity.expiresAt;
    const now = new Date();
    const app = await this.prisma.application.create({
      data: {
        userId,
        opportunityId,
        status: 'SAVED',
        matchScore: job.match.overall,
        deadline,
        prepChecklist: DEFAULT_CHECKLIST.map((label) => ({ id: randomUUID(), label, done: false })) as Prisma.InputJsonValue,
        statusHistory: [{ status: 'SAVED', at: now.toISOString() }],
      },
      include: { opportunity: true, _count: { select: { interviews: true } } },
    });
    await this.prisma.savedOpportunity.upsert({
      where: { userId_opportunityId: { userId, opportunityId } },
      update: {},
      create: { userId, kind: 'OPPORTUNITY', opportunityId },
    });

    let reminderScheduledAt: Date | null = null;
    if (deadline && deadline > now) {
      // Remind two days before the deadline, or in two hours when the deadline is already close.
      const twoDaysBefore = new Date(deadline.getTime() - 2 * 86_400_000);
      reminderScheduledAt = twoDaysBefore > now ? twoDaysBefore : new Date(now.getTime() + 2 * 3_600_000);
      await this.notifications.create(userId, {
        type: 'JOB_DEADLINE',
        title: `Deadline detected: ${opportunity.title}`,
        message: `${opportunity.company} closes applications on ${format(deadline, 'EEEE, d MMM')}. Orbit scheduled a reminder for ${format(reminderScheduledAt, 'EEE d MMM, HH:mm')}.`,
        actionUrl: `/app/discover/applications/${app.id}`,
        dedupeKey: `deadline-detected:${app.id}`,
      });
      await this.notifications.create(userId, {
        type: 'JOB_DEADLINE',
        title: `${opportunity.title} closes ${format(deadline, 'EEE d MMM')}`,
        message: `Finish your ${opportunity.company} application — ${prepProgress(app.prepChecklist)}% of preparation done.`,
        actionUrl: `/app/discover/applications/${app.id}`,
        scheduledAt: reminderScheduledAt,
        dedupeKey: `deadline-reminder:${app.id}`,
      });
    }
    await this.users.award(userId, { type: 'APPLICATION_UPDATED', title: `Saved ${opportunity.title}`, description: opportunity.company, xp: 10 });
    await this.sync.afterChange(userId, 'application_created');
    return { ...this.toView(app), reminderScheduledAt: reminderScheduledAt?.toISOString() ?? null };
  }

  async update(
    userId: string,
    id: string,
    data: { status?: ApplicationStatus; notes?: string | null; deadline?: string | null; prepChecklist?: PrepChecklistItem[] },
  ): Promise<ApplicationView> {
    const app = await this.prisma.application.findFirst({ where: { id, userId }, include: { opportunity: true } });
    if (!app) throw notFound('Application');
    const history = Array.isArray(app.statusHistory) ? [...(app.statusHistory as { status: string; at: string }[])] : [];
    const statusChanged = data.status && data.status !== app.status;
    if (statusChanged) history.push({ status: data.status!, at: new Date().toISOString() });
    let status = data.status ?? app.status;
    // Ticking preparation items moves a saved job into Preparing automatically.
    if (!statusChanged && data.prepChecklist?.some((i) => i.done) && app.status === 'SAVED') {
      status = 'PREPARING';
      history.push({ status, at: new Date().toISOString() });
    }
    const updated = await this.prisma.application.update({
      where: { id },
      data: {
        status,
        notes: data.notes === undefined ? undefined : data.notes,
        deadline: data.deadline === undefined ? undefined : data.deadline ? new Date(data.deadline) : null,
        prepChecklist: data.prepChecklist ? (data.prepChecklist as unknown as Prisma.InputJsonValue) : undefined,
        statusHistory: history as Prisma.InputJsonValue,
        appliedAt: status === 'APPLIED' && !app.appliedAt ? new Date() : undefined,
      },
      include: { opportunity: true, _count: { select: { interviews: true } } },
    });
    if (statusChanged) {
      const xp = data.status === 'OFFER' ? XP_REWARDS.INTERNSHIP_OFFER : data.status === 'APPLIED' || data.status === 'INTERVIEW' ? 50 : 0;
      const verb: Partial<Record<ApplicationStatus, string>> = {
        APPLIED: 'Applied to',
        ASSESSMENT: 'Reached assessment for',
        INTERVIEW: 'Interviewing for',
        OFFER: 'Received an offer for',
        REJECTED: 'Closed application for',
        WITHDRAWN: 'Withdrew from',
        PREPARING: 'Preparing application for',
      };
      await this.users.award(userId, {
        type: 'APPLICATION_UPDATED',
        title: `${verb[data.status!] ?? 'Updated'} ${app.opportunity.title}`,
        description: app.opportunity.company,
        xp,
        metadata: { status: data.status },
      });
    }
    await this.sync.afterChange(userId, statusChanged ? `application:${status}` : 'application_updated');
    return this.toView(updated);
  }

  async remove(userId: string, id: string) {
    const app = await this.prisma.application.findFirst({ where: { id, userId } });
    if (!app) throw notFound('Application');
    await this.prisma.$transaction([
      this.prisma.application.delete({ where: { id } }),
      this.prisma.savedOpportunity.deleteMany({ where: { userId, opportunityId: app.opportunityId } }),
      this.prisma.notification.deleteMany({ where: { userId, status: 'SCHEDULED', dedupeKey: `deadline-reminder:${id}` } }),
    ]);
    await this.sync.afterChange(userId, 'application_removed');
    return { removed: true };
  }

  async detail(userId: string, id: string): Promise<ApplicationDetail> {
    const app = await this.prisma.application.findFirst({
      where: { id, userId },
      include: { opportunity: true, interviews: { orderBy: { createdAt: 'desc' } }, _count: { select: { interviews: true } } },
    });
    if (!app) throw notFound('Application');
    const [job, notes] = await Promise.all([
      this.discover.job(userId, app.opportunityId),
      this.prisma.careerNote.findMany({
        where: {
          userId,
          OR: [
            { content: { contains: app.opportunity.company, mode: 'insensitive' } },
            { title: { contains: app.opportunity.company, mode: 'insensitive' } },
            { tags: { has: app.opportunity.company } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);
    return {
      ...this.toView(app),
      match: job.match,
      interviews: app.interviews.map(toInterviewView),
      relatedNotes: notes.map(toNoteView),
    };
  }

  // -------------------------------------------------------------------------
  // Interview preparation (part of Application Intelligence)
  // -------------------------------------------------------------------------

  async startInterview(userId: string, applicationId: string | null): Promise<InterviewSessionView> {
    const ctx = await this.context.load(userId);
    const app = applicationId
      ? await this.prisma.application.findFirst({ where: { id: applicationId, userId }, include: { opportunity: true } })
      : null;
    if (applicationId && !app) throw notFound('Application');
    const roleSlug = app?.opportunity.roleSlugs[0] ?? ctx.primaryGoal?.role.slug ?? 'product-manager';
    const roleTitle = app?.opportunity.title ?? ctx.primaryGoal?.role.title ?? 'Product Manager';
    const gaps = this.context.gapsFor(ctx).map((g) => g.name);
    const previous = await this.prisma.careerNote.findMany({ where: { userId, type: 'INTERVIEW_REFLECTION' }, orderBy: { createdAt: 'desc' }, take: 3 });

    let questions: InterviewQuestion[] = templateQuestions(roleSlug, app?.opportunity.company ?? null, gaps);
    let generatedBy: 'AI' | 'TEMPLATE' = 'TEMPLATE';
    const ai = await this.ai.generateJson(
      'You are Orbit, an interview coach. Generate 5 realistic, specific interview questions for this candidate and job. Mix behavioural, role-knowledge and one question that probes their biggest gap. Return {"questions":[{"question","focus"}]}.',
      JSON.stringify({
        job: app ? { title: app.opportunity.title, company: app.opportunity.company, description: app.opportunity.description.slice(0, 1500) } : { title: roleTitle },
        candidate: {
          headline: ctx.profile?.headline,
          experiences: ctx.experiences.slice(0, 4).map((e) => `${e.title} at ${e.organization}`),
          gaps: gaps.slice(0, 3),
        },
        previousReflections: previous.map((n) => n.content.slice(0, 300)),
      }),
      InterviewQuestionsSchema,
      900,
      20_000,
    );
    if (ai) {
      questions = ai.questions.slice(0, 5).map((q) => ({ id: randomUUID(), question: q.question, focus: q.focus, answer: null, feedback: null }));
      generatedBy = 'AI';
    }
    const session = await this.prisma.interviewSession.create({
      data: {
        userId,
        applicationId: app?.id ?? null,
        roleTitle,
        company: app?.opportunity.company ?? null,
        questions: questions as unknown as Prisma.InputJsonValue,
        generatedBy,
      },
    });
    return toInterviewView(session);
  }

  private async session(userId: string, id: string) {
    const s = await this.prisma.interviewSession.findFirst({ where: { id, userId }, include: { application: { include: { opportunity: true } } } });
    if (!s) throw notFound('Interview session');
    return s;
  }

  private roleTerms(roleSlug: string | undefined): string[] {
    const role = roleSlug ? ROLE_BY_SLUG.get(roleSlug) : undefined;
    const terms = role?.requirements.flatMap((r) => SKILL_BY_SLUG.get(r.skill)?.aliases.slice(0, 3) ?? []) ?? [];
    return [...terms, 'metric', 'user', 'customer', 'trade-off', 'impact', 'stakeholder'];
  }

  async answer(userId: string, sessionId: string, questionId: string, answer: string): Promise<InterviewSessionView> {
    const s = await this.session(userId, sessionId);
    if (s.status === 'COMPLETED') throw badRequest('This practice session is already completed.');
    const questions = (s.questions as unknown as InterviewQuestion[]).map((q) => ({ ...q }));
    const q = questions.find((x) => x.id === questionId);
    if (!q) throw notFound('Question');
    const scores = scoreAnswer(answer, this.roleTerms(s.application?.opportunity.roleSlugs[0]));
    const aiFeedback = await this.ai.generateText(
      'You are Orbit, a supportive but honest interview coach. Give 2-3 sentences of specific feedback on this answer: one strength and one concrete improvement. No emoji.',
      JSON.stringify({ question: q.question, focus: q.focus, answer: answer.slice(0, 2500) }),
      180,
      12_000,
    );
    q.answer = answer;
    q.feedback = aiFeedback ?? feedbackFor(scores);
    const updated = await this.prisma.interviewSession.update({
      where: { id: sessionId },
      data: { questions: questions as unknown as Prisma.InputJsonValue },
    });
    return toInterviewView(updated);
  }

  async completeInterview(userId: string, sessionId: string): Promise<InterviewSessionView> {
    const s = await this.session(userId, sessionId);
    if (s.status === 'COMPLETED') return toInterviewView(s);
    const questions = s.questions as unknown as InterviewQuestion[];
    const answered = questions.filter((q) => q.answer && q.answer.trim().length > 0);
    if (answered.length === 0) throw badRequest('Answer at least one question before finishing the session.');
    const terms = this.roleTerms(s.application?.opportunity.roleSlugs[0]);
    const scores = averageScores(answered.map((q) => scoreAnswer(q.answer!, terms)));
    const weakest = weakestDimension(scores);
    const summary = `You answered ${answered.length} of ${questions.length} questions. Strongest area: ${
      (Object.entries(scores) as [keyof InterviewScores, number][]).sort((a, b) => b[1] - a[1])[0][0].replace(/([A-Z])/g, ' $1').toLowerCase()
    }. Focus next on ${weakest.label.toLowerCase()}. These are coaching indicators, not exact measurements.`;
    const updated = await this.prisma.interviewSession.update({
      where: { id: sessionId },
      data: { status: 'COMPLETED', completedAt: new Date(), scores: scores as unknown as Prisma.InputJsonValue, summary },
    });
    await this.users.award(userId, {
      type: 'INTERVIEW_PRACTICED',
      title: `Interview practice: ${s.roleTitle}`,
      description: s.company ?? undefined,
      xp: XP_REWARDS.INTERVIEW_PRACTICE,
    });
    // Insights feed long-term memory so the agent can adapt.
    await this.prisma.agentInsight.upsert({
      where: { userId_dedupeKey: { userId, dedupeKey: `interview:${weakest.key}` } },
      update: { status: 'ACTIVE', message: `Your recent practice shows ${weakest.label.toLowerCase()} as the area with the most room to grow (${scores[weakest.key]}/100).`, createdAt: new Date() },
      create: {
        userId,
        type: 'INTERVIEW',
        dedupeKey: `interview:${weakest.key}`,
        title: 'Interview pattern',
        message: `Your recent practice shows ${weakest.label.toLowerCase()} as the area with the most room to grow (${scores[weakest.key]}/100).`,
        evidence: [`Session: ${s.roleTitle}${s.company ? ` at ${s.company}` : ''}`, `${answered.length} answers analysed`],
        suggestedAction: {
          label: 'Add practice quest',
          type: 'ADD_QUEST',
          payload: {
            title: `Strengthen ${weakest.label}`,
            description: `Practise interview answers focused on ${weakest.label.toLowerCase()}.`,
            category: 'INTERVIEW',
            tasks: ['Review two strong example answers', 'Rewrite one of your answers', 'Run another practice session in Orbit'],
          },
        },
      },
    });
    await this.sync.afterChange(userId, 'interview_completed');
    return toInterviewView(updated);
  }
}

function toInterviewView(s: {
  id: string;
  applicationId: string | null;
  roleTitle: string;
  company: string | null;
  status: 'IN_PROGRESS' | 'COMPLETED';
  questions: unknown;
  scores: unknown;
  summary: string | null;
  generatedBy: string;
  createdAt: Date;
  completedAt: Date | null;
}): InterviewSessionView {
  return {
    id: s.id,
    applicationId: s.applicationId,
    roleTitle: s.roleTitle,
    company: s.company,
    status: s.status,
    questions: (s.questions as InterviewQuestion[]) ?? [],
    scores: (s.scores as InterviewScores | null) ?? null,
    summary: s.summary,
    generatedBy: s.generatedBy === 'AI' ? 'AI' : 'TEMPLATE',
    createdAt: s.createdAt.toISOString(),
    completedAt: s.completedAt?.toISOString() ?? null,
  };
}

// ---------------------------------------------------------------------------

class CreateApplicationDto {
  @IsUUID() opportunityId!: string;
}

class ChecklistItemDto {
  @IsString() id!: string;
  @IsString() @MaxLength(160) label!: string;
  @IsBoolean() done!: boolean;
}

class UpdateApplicationDto {
  @IsOptional() @IsEnum(ApplicationStatus) status?: ApplicationStatus;
  @IsOptional() @ValidateIf((o) => o.notes !== null) @IsString() @MaxLength(5000) notes?: string | null;
  @IsOptional() @ValidateIf((o) => o.deadline !== null) @IsDateString() deadline?: string | null;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ChecklistItemDto) prepChecklist?: ChecklistItemDto[];
}

class StartInterviewDto {
  @IsOptional() @IsUUID() applicationId?: string;
}

class AnswerDto {
  @IsString() questionId!: string;
  @IsString() @MinLength(5) @MaxLength(5000) answer!: string;
}

@Controller()
export class ApplicationsController {
  constructor(private readonly apps: ApplicationsService) {}

  @Get('applications')
  list(@CurrentUser() user: AuthUser) {
    return this.apps.list(user.id);
  }

  @Post('applications')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateApplicationDto) {
    return this.apps.create(user.id, dto.opportunityId);
  }

  @Get('applications/:id')
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.apps.detail(user.id, id);
  }

  @Patch('applications/:id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateApplicationDto) {
    return this.apps.update(user.id, id, dto);
  }

  @Delete('applications/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.apps.remove(user.id, id);
  }

  @Post('interviews')
  start(@CurrentUser() user: AuthUser, @Body() dto: StartInterviewDto) {
    return this.apps.startInterview(user.id, dto.applicationId ?? null);
  }

  @Post('interviews/:id/answers')
  answer(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AnswerDto) {
    return this.apps.answer(user.id, id, dto.questionId, dto.answer);
  }

  @Post('interviews/:id/complete')
  complete(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.apps.completeInterview(user.id, id);
  }
}

@Module({ controllers: [ApplicationsController], providers: [ApplicationsService], exports: [ApplicationsService] })
export class ApplicationsModule {}
