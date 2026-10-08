import { Injectable, Logger } from '@nestjs/common';
import type { AgentAction, Prisma } from '@prisma/client';
import { addDays, addHours, format, nextMonday, set } from 'date-fns';
import {
  APPLICATION_STATUSES,
  OPPORTUNITY_TYPES,
  type AgentActionLevel,
  type AgentActionType,
  type AgentToolName,
  type ApplicationStatus,
  type OpportunityType,
} from '@orbit/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SKILL_BY_SLUG, SKILLS } from '../../catalog/skills.catalog';
import { ROLE_BY_SLUG, questTemplateForSkill } from '../../catalog/roles.catalog';
import { CareerContextService } from '../career/career-context.service';
import { ReadinessService } from '../career/readiness.service';
import { DiscoverService } from '../discover/discover.service';
import { ProfilesService } from '../profiles/profiles.service';
import { NextBestActionService } from '../progress/next-best-action.service';
import { resolveSkillSlug } from '../skills/skill-matcher';
import type { ToolDefinition } from '../ai/ai.types';
import { ContextBuilderService } from './context-builder.service';

export interface ToolResult {
  summary: string;
  data: unknown;
  actions: AgentAction[];
}

interface ToolSpec {
  name: AgentToolName;
  level: AgentActionLevel;
  description: string;
  parameters: Record<string, unknown>;
}

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required });

export const TOOL_SPECS: ToolSpec[] = [
  { name: 'get_user_context', level: 'READ', description: 'Get the concise long-term career context of the user: target role, readiness, top gaps, current quest, applications, insights.', parameters: obj({}) },
  { name: 'analyze_career_profile', level: 'READ', description: 'Analyze the structured career profile: Career DNA traits, strengths, experiences and readiness breakdown.', parameters: obj({}) },
  {
    name: 'analyze_career_gap',
    level: 'READ',
    description: 'Compare the user with a target career and list skill gaps with current vs required levels. Defaults to the primary target role.',
    parameters: obj({ roleSlug: { type: 'string', description: 'Optional role slug, e.g. product-manager, software-engineer, ai-engineer, data-analyst, ux-designer' } }),
  },
  {
    name: 'find_opportunities',
    level: 'READ',
    description: 'Find jobs and internships ranked by hybrid match score with explanations.',
    parameters: obj({ type: { type: 'string', enum: [...OPPORTUNITY_TYPES] }, query: { type: 'string' }, limit: { type: 'number' } }),
  },
  {
    name: 'search_growth_resources',
    level: 'READ',
    description: 'Find courses, certifications, workshops, seminars, competitions, hackathons and career events relevant to a skill or the user’s gaps.',
    parameters: obj({ skill: { type: 'string', description: 'Skill name to focus on' }, limit: { type: 'number' } }),
  },
  { name: 'search_books', level: 'READ', description: 'Find relevant books for the user’s goal or a specific skill.', parameters: obj({ query: { type: 'string' }, skill: { type: 'string' } }) },
  { name: 'search_papers', level: 'READ', description: 'Find relevant research papers connected to the user’s career, gaps or interests.', parameters: obj({ query: { type: 'string' }, skill: { type: 'string' } }) },
  {
    name: 'find_role_models',
    level: 'READ',
    description: 'Find public role models and mentors relevant to the user’s target career, with a comparison to the user.',
    parameters: obj({ kind: { type: 'string', enum: ['ROLE_MODEL', 'MENTOR'] } }),
  },
  {
    name: 'build_career_journey',
    level: 'WRITE',
    description: 'Propose generating (or expanding) the career journey with milestones and quests, or adding one skill to it. Requires user confirmation.',
    parameters: obj({ skill: { type: 'string', description: 'Optional: add only this skill to the journey' } }),
  },
  {
    name: 'update_career_graph',
    level: 'SUGGEST',
    description: 'Suggest adding a node (skill, interest, project, etc.) to the user’s Career Universe. The user confirms.',
    parameters: obj({ label: { type: 'string' }, nodeType: { type: 'string', enum: ['SKILL', 'PROJECT', 'GOAL', 'EXPERIENCE', 'CERTIFICATION'] }, description: { type: 'string' } }, ['label']),
  },
  {
    name: 'update_progress',
    level: 'WRITE',
    description: 'Propose marking a task of the current quest as done when the user says they finished it. Requires confirmation.',
    parameters: obj({ taskTitle: { type: 'string', description: 'Title or part of the title of the task the user completed' } }, ['taskTitle']),
  },
  {
    name: 'manage_application',
    level: 'WRITE',
    description: 'Propose saving a job as an application, or changing an application status. Requires confirmation.',
    parameters: obj({
      action: { type: 'string', enum: ['save', 'update_status'] },
      opportunityId: { type: 'string' },
      applicationId: { type: 'string' },
      company: { type: 'string', description: 'Company name to find the application when no id is known' },
      status: { type: 'string', enum: [...APPLICATION_STATUSES] },
    }, ['action']),
  },
  {
    name: 'create_reminder',
    level: 'SUGGEST',
    description: 'Propose a reminder. "when" accepts an ISO date or phrases like "tomorrow 19:00", "in 2 days", "next monday".',
    parameters: obj({ title: { type: 'string' }, when: { type: 'string' }, message: { type: 'string' } }, ['title', 'when']),
  },
  { name: 'get_next_best_action', level: 'READ', description: 'Determine what the user should prioritise next, with reason and expected impact.', parameters: obj({}) },
];

export const TOOL_BY_NAME = new Map(TOOL_SPECS.map((t) => [t.name, t]));

export function toolDefinitions(): ToolDefinition[] {
  return TOOL_SPECS.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters }));
}

/** Parse simple natural-language reminder times. */
export function parseWhen(when: string, now = new Date()): Date | null {
  if (!Number.isNaN(Date.parse(when)) && /\d{4}-\d{2}-\d{2}/.test(when)) return new Date(when);
  const w = when.toLowerCase();
  const time = w.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  let hours = 9;
  let minutes = 0;
  if (time && /:|am|pm|jam|pukul|at /.test(w)) {
    hours = Number(time[1]) % 24;
    minutes = Number(time[2] ?? 0);
    if (time[3] === 'pm' && hours < 12) hours += 12;
  }
  const at = (d: Date) => set(d, { hours, minutes, seconds: 0, milliseconds: 0 });
  let m = w.match(/in (\d+) (hour|hours|jam)/);
  if (m) return addHours(now, Number(m[1]));
  m = w.match(/in (\d+) (day|days|hari)/);
  if (m) return at(addDays(now, Number(m[1])));
  if (/tomorrow|besok/.test(w)) return at(addDays(now, 1));
  if (/next week|minggu depan/.test(w)) return at(addDays(now, 7));
  if (/monday|senin/.test(w)) return at(nextMonday(now));
  if (/tonight|today|hari ini|malam ini/.test(w)) return at(now) > now ? at(now) : addHours(now, 1);
  return null;
}

@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger('AgentTools');

  constructor(
    private readonly prisma: PrismaService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly context: CareerContextService,
    private readonly readiness: ReadinessService,
    private readonly discover: DiscoverService,
    private readonly profiles: ProfilesService,
    private readonly nba: NextBestActionService,
  ) {}

  private async record(
    userId: string,
    conversationId: string | null,
    input: { tool: AgentToolName; level: AgentActionLevel; type: AgentActionType | 'TOOL_CALL'; title: string; description: string; inputSummary: string; outputSummary?: string; payload?: Record<string, unknown>; status: AgentAction['status'] },
  ): Promise<AgentAction> {
    return this.prisma.agentAction.create({
      data: {
        userId,
        conversationId,
        type: input.type,
        tool: input.tool,
        level: input.level,
        title: input.title,
        description: input.description,
        inputSummary: input.inputSummary.slice(0, 500),
        outputSummary: input.outputSummary?.slice(0, 500),
        payload: (input.payload ?? {}) as Prisma.InputJsonValue,
        status: input.status,
        confirmationRequired: input.status === 'PENDING_CONFIRMATION' || input.status === 'SUGGESTED',
        executedAt: input.status === 'EXECUTED' ? new Date() : null,
      },
    });
  }

  /** Suggest-level card the user can accept with one click. */
  private suggest(userId: string, conversationId: string | null, tool: AgentToolName, type: AgentActionType, title: string, description: string, payload: Record<string, unknown>) {
    return this.record(userId, conversationId, { tool, level: 'SUGGEST', type, title, description, inputSummary: JSON.stringify(payload), payload, status: 'SUGGESTED' });
  }

  /** Write-level action that must be explicitly confirmed. */
  private pending(userId: string, conversationId: string | null, tool: AgentToolName, type: AgentActionType, title: string, description: string, payload: Record<string, unknown>) {
    return this.record(userId, conversationId, { tool, level: 'WRITE', type, title, description, inputSummary: JSON.stringify(payload), payload, status: 'PENDING_CONFIRMATION' });
  }

  async execute(userId: string, name: string, args: Record<string, unknown>, conversationId: string | null = null): Promise<ToolResult> {
    const spec = TOOL_BY_NAME.get(name as AgentToolName);
    if (!spec) return { summary: `Unknown tool ${name}`, data: { error: `Unknown tool ${name}` }, actions: [] };
    const started = Date.now();
    try {
      const result = await this.run(userId, spec.name, args ?? {}, conversationId);
      // Audit every read; suggest/write tools already persisted their own actions.
      if (spec.level === 'READ') {
        await this.record(userId, conversationId, {
          tool: spec.name,
          level: 'READ',
          type: 'TOOL_CALL',
          title: spec.name,
          description: result.summary,
          inputSummary: JSON.stringify(args ?? {}),
          outputSummary: `${result.summary} (${Date.now() - started} ms)`,
          status: 'EXECUTED',
        });
      }
      return result;
    } catch (error) {
      this.logger.warn(`Tool ${name} failed: ${(error as Error).message}`);
      await this.record(userId, conversationId, {
        tool: spec.name,
        level: spec.level,
        type: 'TOOL_CALL',
        title: spec.name,
        description: 'Tool failed',
        inputSummary: JSON.stringify(args ?? {}),
        outputSummary: (error as Error).message,
        status: 'FAILED',
      });
      return { summary: `${name} is temporarily unavailable`, data: { error: 'Tool temporarily unavailable. Continue with the context you have.' }, actions: [] };
    }
  }

  private async run(userId: string, name: AgentToolName, args: Record<string, unknown>, conversationId: string | null): Promise<ToolResult> {
    const str = (k: string) => (typeof args[k] === 'string' && (args[k] as string).trim() ? (args[k] as string).trim() : undefined);
    const num = (k: string, d: number) => (typeof args[k] === 'number' ? Math.max(1, Math.min(10, args[k] as number)) : d);

    switch (name) {
      case 'get_user_context': {
        const data = await this.contextBuilder.build(userId);
        return { summary: 'Loaded career context', data, actions: [] };
      }

      case 'analyze_career_profile': {
        const intel = await this.profiles.intelligence(userId);
        return {
          summary: `Career DNA: ${intel.careerDna.headline}`,
          data: {
            careerDna: intel.careerDna,
            targetRole: intel.targetRole?.title,
            readiness: intel.readiness ? { score: Math.round(intel.readiness.score), breakdown: intel.readiness.breakdown.map((b) => ({ category: b.label, score: b.score, details: b.details })) } : null,
            strengths: intel.strengths.map((s) => ({ skill: s.name, level: s.level })),
            experiences: intel.experienceHighlights.map((e) => `${e.title} — ${e.organization} (${e.type})`),
          },
          actions: [],
        };
      }

      case 'analyze_career_gap': {
        const ctx = await this.context.load(userId);
        const roleSlug = str('roleSlug');
        let gaps;
        let roleTitle = ctx.primaryGoal?.role.title ?? null;
        const goal = roleSlug ? ctx.goals.find((g) => g.role.slug === roleSlug) : ctx.primaryGoal;
        if (goal) {
          gaps = this.context.gapsFor(ctx, goal);
          roleTitle = goal.role.title;
        } else if (roleSlug && ROLE_BY_SLUG.has(roleSlug)) {
          const role = ROLE_BY_SLUG.get(roleSlug)!;
          roleTitle = role.title;
          gaps = role.requirements
            .map((r) => ({ name: SKILL_BY_SLUG.get(r.skill)?.name ?? r.skill, slug: r.skill, currentLevel: ctx.skillLevelsBySlug.get(r.skill) ?? 0, requiredLevel: r.level, importance: r.importance, inJourney: false }))
            .filter((g) => g.currentLevel < g.requiredLevel)
            .sort((a, b) => b.importance * (b.requiredLevel - b.currentLevel) - a.importance * (a.requiredLevel - a.currentLevel));
        } else {
          return { summary: 'No target role set', data: { error: 'The user has no target role yet.' }, actions: [] };
        }
        const top = gaps.slice(0, 5);
        const actions: AgentAction[] = [];
        const first = top.find((g) => !g.inJourney);
        if (first && goal?.isPrimary) {
          const jobs = await this.prisma.opportunity.count({ where: { isActive: true, skills: { has: first.slug }, roleSlugs: { has: goal.role.slug } } });
          actions.push(
            await this.suggest(userId, conversationId, name, 'ADD_SKILL_TO_JOURNEY', `Add ${first.name} to Journey`, `${first.name} is required by ${jobs} matching job${jobs === 1 ? '' : 's'}. Orbit will create the quest “${questTemplateForSkill(first.slug).title}”.`, {
              skillSlug: first.slug,
            }),
          );
        }
        return {
          summary: `Found ${gaps.length} gaps for ${roleTitle}`,
          data: { role: roleTitle, gaps: top.map((g) => ({ skill: g.name, current: g.currentLevel, required: g.requiredLevel, inJourney: g.inJourney })) },
          actions,
        };
      }

      case 'find_opportunities': {
        const type = OPPORTUNITY_TYPES.includes(str('type') as OpportunityType) ? (str('type') as OpportunityType) : undefined;
        const jobs = await this.discover.jobs(userId, { type, q: str('query'), limit: num('limit', 5) });
        const actions: AgentAction[] = [];
        const best = jobs.find((j) => !j.saved);
        if (best) {
          actions.push(
            await this.suggest(userId, conversationId, name, 'SAVE_OPPORTUNITY', `Save ${best.opportunity.title}`, `${best.opportunity.company} · ${best.match.overall}% match. Orbit will track it and remind you before the deadline.`, {
              opportunityId: best.opportunity.id,
            }),
          );
        }
        return {
          summary: `Found ${jobs.length} matching opportunities`,
          data: jobs.map((j) => ({
            opportunityId: j.opportunity.id,
            title: j.opportunity.title,
            company: j.opportunity.company,
            type: j.opportunity.employmentType,
            location: j.opportunity.location,
            deadline: j.opportunity.deadline ? format(new Date(j.opportunity.deadline), 'd MMM') : null,
            match: j.match.overall,
            whyYouMatch: j.match.reasons,
            missing: j.match.missingSkills.map((m) => m.name),
            saved: j.saved,
          })),
          actions,
        };
      }

      case 'search_growth_resources': {
        const skill = str('skill');
        const slug = skill ? resolveSkillSlug(skill) : null;
        const all = await this.discover.growth(userId);
        const items = (slug ? all.filter((g) => g.skills.includes(SKILL_BY_SLUG.get(slug)?.name ?? '')) : all).slice(0, num('limit', 5));
        const actions: AgentAction[] = [];
        const event = items.find((i) => i.kind === 'EVENT' && !i.saved);
        if (event) {
          actions.push(await this.suggest(userId, conversationId, name, 'SAVE_RESOURCE', `Save ${event.title}`, event.why.whyItMatters, { kind: 'EVENT', itemId: event.id }));
        }
        return {
          summary: `Found ${items.length} growth resources${skill ? ` for ${skill}` : ''}`,
          data: items.map((i) => ({ title: i.title, type: i.type, provider: i.provider, date: i.startsAt ? format(new Date(i.startsAt), 'EEE d MMM, HH:mm') : null, relevance: i.relevance, why: i.why.whyItMatters, url: i.url })),
          actions,
        };
      }

      case 'search_books': {
        const skill = str('skill');
        let books = await this.discover.books(userId, str('query'));
        if (skill) books = books.filter((b) => b.skills.some((s) => s.toLowerCase().includes(skill.toLowerCase())));
        return {
          summary: `Found ${Math.min(5, books.length)} books`,
          data: books.slice(0, 5).map((b) => ({ title: b.title, authors: b.authors, level: b.level, why: b.why.whyItMatters, relevance: b.relevance })),
          actions: [],
        };
      }

      case 'search_papers': {
        const skill = str('skill');
        let papers = await this.discover.papers(userId, str('query'));
        if (skill) papers = papers.filter((p) => p.skills.some((s) => s.toLowerCase().includes(skill.toLowerCase())));
        return {
          summary: `Found ${Math.min(4, papers.length)} papers`,
          data: papers.slice(0, 4).map((p) => ({ title: p.title, authors: p.authors.slice(0, 3), year: p.year, why: p.why.whyItMatters, url: p.url })),
          actions: [],
        };
      }

      case 'find_role_models': {
        const kind = str('kind') === 'MENTOR' ? 'MENTOR' : str('kind') === 'ROLE_MODEL' ? 'ROLE_MODEL' : undefined;
        const people = (await this.discover.people(userId, kind)).slice(0, 3);
        return {
          summary: `Found ${people.length} relevant people`,
          data: people.map((p) => ({ name: p.name, kind: p.kind, headline: p.headline, similarities: p.comparison.similarities, differences: p.comparison.differences, insight: p.comparison.insight, recommendedAction: p.comparison.recommendedAction })),
          actions: [],
        };
      }

      case 'build_career_journey': {
        const skill = str('skill');
        const slug = skill ? resolveSkillSlug(skill) : null;
        if (slug) {
          const tpl = questTemplateForSkill(slug);
          const action = await this.suggest(userId, conversationId, name, 'ADD_SKILL_TO_JOURNEY', `Add ${SKILL_BY_SLUG.get(slug)?.name ?? skill} to Journey`, `Creates the quest “${tpl.title}” (${tpl.tasks.length} tasks, ${tpl.xp} XP).`, { skillSlug: slug });
          return { summary: 'Proposed adding a skill to the journey (awaiting confirmation)', data: { status: 'awaiting_user_confirmation', quest: tpl.title }, actions: [action] };
        }
        const ctx = await this.context.load(userId);
        if (!ctx.primaryGoal) return { summary: 'No target role set', data: { error: 'Set a target role first.' }, actions: [] };
        const has = Boolean(ctx.primaryGoal.journey);
        const action = await this.pending(userId, conversationId, name, 'BUILD_JOURNEY', has ? `Expand your ${ctx.primaryGoal.role.title} Journey` : `Generate your ${ctx.primaryGoal.role.title} Journey`, has ? 'Adds the remaining milestones and quests for your role.' : 'Creates milestones and quests from your gaps.', {});
        return { summary: 'Proposed journey generation (awaiting confirmation)', data: { status: 'awaiting_user_confirmation' }, actions: [action] };
      }

      case 'update_career_graph': {
        const label = str('label');
        if (!label) return { summary: 'Missing label', data: { error: 'label is required' }, actions: [] };
        const nodeType = ['SKILL', 'PROJECT', 'GOAL', 'EXPERIENCE', 'CERTIFICATION'].includes(str('nodeType') ?? '') ? str('nodeType') : 'SKILL';
        const action = await this.suggest(userId, conversationId, name, 'ADD_GRAPH_NODE', `Add “${label}” to your Universe`, str('description') ?? 'Connect this to your Career Universe.', { label, nodeType, description: str('description') });
        return { summary: 'Suggested a Career Universe update', data: { status: 'awaiting_user_confirmation' }, actions: [action] };
      }

      case 'update_progress': {
        const taskTitle = (str('taskTitle') ?? '').toLowerCase();
        const quests = await this.prisma.quest.findMany({ where: { userId, status: { not: 'COMPLETED' } }, include: { tasks: true } });
        const words = taskTitle.split(/\s+/).filter((w) => w.length > 3);
        let best: { questId: string; questTitle: string; taskId: string; taskTitle: string; score: number } | null = null;
        for (const q of quests) {
          for (const t of q.tasks.filter((x) => !x.completed)) {
            const score = words.filter((w) => t.title.toLowerCase().includes(w)).length;
            if (score > 0 && (!best || score > best.score)) best = { questId: q.id, questTitle: q.title, taskId: t.id, taskTitle: t.title, score };
          }
        }
        if (!best) return { summary: 'No matching open task', data: { error: 'No open task matches that description.' }, actions: [] };
        const action = await this.pending(userId, conversationId, name, 'UPDATE_QUEST_PROGRESS', `Mark “${best.taskTitle}” as done`, `Part of ${best.questTitle}.`, { questId: best.questId, taskId: best.taskId, completed: true });
        return { summary: 'Proposed a progress update (awaiting confirmation)', data: { status: 'awaiting_user_confirmation', task: best.taskTitle }, actions: [action] };
      }

      case 'manage_application': {
        const action = str('action');
        if (action === 'save') {
          const opportunityId = str('opportunityId');
          const job = opportunityId ? await this.prisma.opportunity.findUnique({ where: { id: opportunityId } }) : null;
          if (!job) return { summary: 'Opportunity not found', data: { error: 'Use find_opportunities to get a valid opportunityId first.' }, actions: [] };
          const a = await this.pending(userId, conversationId, name, 'SAVE_OPPORTUNITY', `Save ${job.title}`, `${job.company} — Orbit will track it and remind you before the deadline.`, { opportunityId: job.id });
          return { summary: 'Proposed saving an opportunity (awaiting confirmation)', data: { status: 'awaiting_user_confirmation' }, actions: [a] };
        }
        const status = str('status') as ApplicationStatus | undefined;
        if (!status || !APPLICATION_STATUSES.includes(status)) return { summary: 'Invalid status', data: { error: 'Provide a valid status.' }, actions: [] };
        const company = str('company');
        const app = await this.prisma.application.findFirst({
          where: { userId, ...(str('applicationId') ? { id: str('applicationId') } : company ? { opportunity: { company: { contains: company, mode: 'insensitive' } } } : {}) },
          include: { opportunity: true },
          orderBy: { updatedAt: 'desc' },
        });
        if (!app) return { summary: 'Application not found', data: { error: 'No matching application.' }, actions: [] };
        const a = await this.pending(userId, conversationId, name, 'UPDATE_APPLICATION_STATUS', `Move ${app.opportunity.title} to ${status.toLowerCase()}`, `${app.opportunity.company} · currently ${app.status.toLowerCase()}.`, { applicationId: app.id, status });
        return { summary: 'Proposed an application status change (awaiting confirmation)', data: { status: 'awaiting_user_confirmation' }, actions: [a] };
      }

      case 'create_reminder': {
        const title = str('title') ?? 'Career reminder';
        const when = parseWhen(str('when') ?? '');
        if (!when) return { summary: 'Could not understand the time', data: { error: 'Ask the user for a specific time.' }, actions: [] };
        const a = await this.suggest(userId, conversationId, name, 'CREATE_REMINDER', `Remind me: ${title}`, format(when, "EEEE, d MMM 'at' HH:mm"), { title, scheduledAt: when.toISOString(), message: str('message') ?? 'Reminder from Orbit' });
        return { summary: 'Proposed a reminder (awaiting confirmation)', data: { status: 'awaiting_user_confirmation', when: when.toISOString() }, actions: [a] };
      }

      case 'get_next_best_action': {
        const nba = await this.nba.compute(userId);
        const actions: AgentAction[] = [];
        if (nba?.action) {
          actions.push(await this.suggest(userId, conversationId, name, nba.action.type, nba.actionLabel === 'Add to Journey' ? nba.title.replace(/ to your journey$/i, ' to Journey') : nba.title, `${nba.reason} ${nba.expectedImpact}`, nba.action.payload));
        } else if (nba) {
          actions.push(await this.suggest(userId, conversationId, name, 'NAVIGATE', nba.actionLabel, nba.title, { url: nba.actionUrl }));
        }
        return { summary: nba ? `Next best action: ${nba.title}` : 'No pending action', data: nba, actions };
      }
    }
  }

  skillNames(): string[] {
    return SKILLS.map((s) => s.name);
  }
}
