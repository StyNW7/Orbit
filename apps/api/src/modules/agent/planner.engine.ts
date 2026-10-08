import { Injectable } from '@nestjs/common';
import type { AgentAction } from '@prisma/client';
import type { AgentPageContext, AgentToolName, ToolCallView } from '@orbit/shared';
import type { ContextPackage } from './context-builder.service';
import { ToolRegistryService } from './tool-registry.service';

export interface EngineResult {
  content: string;
  toolCalls: ToolCallView[];
  actions: AgentAction[];
}

type Intent =
  | 'reminder'
  | 'progress'
  | 'focus'
  | 'job_readiness'
  | 'jobs'
  | 'gaps'
  | 'books'
  | 'papers'
  | 'growth'
  | 'people'
  | 'journey'
  | 'node'
  | 'overview';

export function detectIntent(message: string, page?: AgentPageContext): Intent {
  const m = message.toLowerCase();
  if (/\b(remind|reminder|ingatkan)\b/.test(m)) return 'reminder';
  if (/\b(i (just )?(finished|completed|did)|i'?m done with|sudah selesai)\b/.test(m)) return 'progress';
  if (/(ready to apply|am i ready|should i apply|siap melamar)/.test(m)) return page?.entityType === 'job' || page?.entityType === 'application' ? 'job_readiness' : 'jobs';
  if (/(focus|this week|minggu ini|prioriti[sz]e|what should i (do|work)|next step|where (do|should) i start)/.test(m)) return 'focus';
  if (/\b(job|jobs|intern|internship|opportunit|vacanc|lowongan|position|role openings)\b/.test(m)) return 'jobs';
  if (/\b(paper|papers|research|jurnal|journal article|study)\b/.test(m)) return 'papers';
  if (/\b(book|books|buku|read)\b/.test(m)) return 'books';
  if (/\b(course|courses|event|events|workshop|seminar|certif|hackathon|competition|bootcamp|conference)\b/.test(m)) return 'growth';
  if (/\b(mentor|role model|inspir|people like me|who should i learn)\b/.test(m)) return 'people';
  if (/\b(why|important|matter)\b/.test(m) && page?.entityType === 'node') return 'node';
  if (/\b(gap|gaps|missing|weak|improve|kurang|lacking)\b/.test(m)) return 'gaps';
  if (/\b(journey|roadmap|plan|quest|milestone)\b/.test(m)) return 'journey';
  return 'overview';
}

/**
 * Deterministic planner: Orbit's always-available reasoning path. It selects
 * real tools by intent and composes a structured answer from their results,
 * so the agent keeps working when Langflow or the model are offline.
 */
@Injectable()
export class PlannerEngine {
  constructor(private readonly tools: ToolRegistryService) {}

  async run(userId: string, message: string, ctx: ContextPackage, page: AgentPageContext | undefined, conversationId: string): Promise<EngineResult> {
    const toolCalls: ToolCallView[] = [];
    const actions: AgentAction[] = [];
    const call = async (tool: AgentToolName, args: Record<string, unknown> = {}) => {
      const started = Date.now();
      const r = await this.tools.execute(userId, tool, args, conversationId);
      toolCalls.push({ tool, summary: r.summary, durationMs: Date.now() - started });
      actions.push(...r.actions);
      return r.data as any;
    };

    const role = ctx.targetRole ?? 'your target role';
    const gap = ctx.topGaps[0];
    const intent = detectIntent(message, page);
    let content: string;

    if (!ctx.targetRole && intent !== 'reminder') {
      content = section(
        'Orbit needs a target role to guide you.',
        'Readiness, gaps and recommendations are all measured against the career you are aiming for.',
        'Finish onboarding: choose a target role and upload your CV.',
        'Unlocks Career Intelligence, your Career Universe and a personalised journey.',
      );
      return { content, toolCalls, actions };
    }

    switch (intent) {
      case 'focus':
      case 'overview': {
        await call('get_user_context');
        const nba = await call('get_next_best_action');
        const app = ctx.activeApplications.find((a) => a.daysLeft !== null && a.daysLeft >= 0) ?? ctx.activeApplications[0];
        const weakest = ctx.readinessBreakdown ? Object.entries(ctx.readinessBreakdown).sort((a, b) => a[1] - b[1])[0] : null;
        const focusTopic = ctx.currentQuest?.title ?? (gap ? gap.skill : role);
        const why: string[] = [];
        if (gap) why.push(`**${gap.skill}** is your largest ${role} gap (level ${gap.current} of ${gap.required}).`);
        if (ctx.currentQuest) why.push(`Your current quest **${ctx.currentQuest.title}** is ${ctx.currentQuest.progress}% complete${ctx.currentQuest.nextTask ? ` — next task: *${ctx.currentQuest.nextTask}*` : ''}.`);
        if (app) why.push(`**${app.role}** at ${app.company} is in *${app.stage.toLowerCase()}*${app.deadline ? `, deadline ${app.deadline}${app.daysLeft !== null ? ` (${app.daysLeft} day${app.daysLeft === 1 ? '' : 's'} left)` : ''}` : ''}.`);
        if (ctx.careerReadiness !== null) why.push(`Career Readiness is **${ctx.careerReadiness}%**${weakest ? `; ${weakest[0]} is your lowest category (${weakest[1]}).` : '.'}`);
        if (ctx.recentInsights[0]) why.push(`Recent insight: ${ctx.recentInsights[0]}`);

        const plan: string[] = [];
        if (ctx.currentQuest?.nextTask) plan.push(`| Early week | ${ctx.currentQuest.nextTask} |`);
        if (app && ['SAVED', 'PREPARING'].includes(app.stage)) plan.push(`| Mid-week | Finish and submit the ${app.company} application${app.deadline ? ` before ${app.deadline}` : ''} |`);
        else if (app?.stage === 'INTERVIEW') plan.push(`| Mid-week | Run a mock interview for ${app.company} |`);
        if (gap && !gap.inJourney) plan.push(`| Any day | Add ${gap.skill} to your journey and start its first task |`);
        plan.push('| Weekend | Write a short reflection in your Career Journal |');

        content =
          `### Insight\n` +
          (intent === 'focus'
            ? `This week, your highest-leverage focus is **${focusTopic}**${app && ['SAVED', 'PREPARING'].includes(app.stage) ? `, while keeping the **${app.company}** application on track` : ''}.\n\n`
            : `You are ${ctx.careerReadiness ?? '—'}% ready for **${role}**. ${gap ? `${gap.skill} is the gap that matters most right now.` : 'Your core skills are in place.'}\n\n`) +
          `### Why it matters\n${why.map((w) => `- ${w}`).join('\n')}\n\n` +
          `### Next best action\n${nba ? `**${nba.title}** — ${nba.reason}` : 'Keep progressing your current quest.'}\n\n` +
          (intent === 'focus' ? `### This week\n| When | Focus |\n|---|---|\n${plan.join('\n')}\n\n` : '') +
          `### Expected impact\n${nba?.expectedImpact ?? 'Steady progress toward career readiness.'}`;
        break;
      }

      case 'gaps': {
        const data = await call('analyze_career_gap');
        const gaps: { skill: string; current: number; required: number; inJourney: boolean }[] = data?.gaps ?? [];
        content =
          `### Insight\n${gaps.length ? `You have ${gaps.length} open skill gap${gaps.length === 1 ? '' : 's'} for **${data.role}**. The biggest is **${gaps[0].skill}**.` : `You meet the core skill requirements for **${data?.role ?? role}**.`}\n\n` +
          (gaps.length
            ? `### Why it matters\n| Skill | Current | Required | In journey |\n|---|---|---|---|\n${gaps.map((g) => `| ${g.skill} | ${g.current} | ${g.required} | ${g.inJourney ? 'Yes' : 'No'} |`).join('\n')}\n\n`
            : '') +
          `### Next best action\n${gaps[0] ? (gaps[0].inJourney ? `Keep going with your ${gaps[0].skill} quest.` : `Add **${gaps[0].skill}** to your journey — a confirmation card is below.`) : 'Shift focus to portfolio and applications.'}\n\n` +
          `### Expected impact\nClosing the top gap raises Skill Match, the largest readiness category (30%).`;
        break;
      }

      case 'jobs':
      case 'job_readiness': {
        if (intent === 'job_readiness' && page?.entityId) {
          const jobs = await call('find_opportunities', { limit: 10 });
          const job = (jobs as any[]).find((j) => j.opportunityId === page.entityId) ?? (jobs as any[])[0];
          if (job) {
            const ready = job.match >= 75;
            content =
              `### Insight\n${ready ? `Yes — you are a strong candidate for **${job.title}** (${job.match}% match).` : `You are a partial match for **${job.title}** (${job.match}%). You can apply, but strengthen a few areas first.`}\n\n` +
              `### Why it matters\n- Why you match: ${job.whyYouMatch.join(', ') || 'relevant background'}\n- Missing: ${job.missing.join(', ') || 'nothing critical'}\n${job.deadline ? `- Deadline: ${job.deadline}\n` : ''}\n` +
              `### Next best action\n${job.missing[0] ? `Add **${job.missing[0]}** to your journey and mention related projects in your CV.` : 'Tailor your CV and apply this week.'}\n\n` +
              `### Expected impact\nA tailored application lifts Application Readiness; closing ${job.missing[0] ?? 'gaps'} lifts Skill Match.`;
            break;
          }
        }
        const type = /intern/.test(message.toLowerCase()) ? 'INTERNSHIP' : undefined;
        const jobs = (await call('find_opportunities', { type, limit: 5 })) as any[];
        content = jobs.length
          ? `### Insight\nOrbit found ${jobs.length} opportunities aligned with **${role}**. The strongest is **${jobs[0].title}** at ${jobs[0].company} (${jobs[0].match}% match).\n\n` +
            `### Why it matters\n| Role | Company | Match | Missing |\n|---|---|---|---|\n${jobs.map((j) => `| ${j.title} | ${j.company} | ${j.match}% | ${j.missing.slice(0, 2).join(', ') || '—'} |`).join('\n')}\n\n` +
            `### Next best action\nSave **${jobs[0].title}** so Orbit tracks its deadline${jobs[0].deadline ? ` (${jobs[0].deadline})` : ''}.\n\n` +
            `### Expected impact\nA saved, prepared application moves Application Readiness forward.`
          : `### Insight\nWe're still mapping opportunities that match your Orbit.\n\n### Next best action\nRefresh opportunities in Discover or broaden your work-mode preferences.`;
        break;
      }

      case 'growth': {
        const items = (await call('search_growth_resources', { skill: gap?.skill, limit: 5 })) as any[];
        content =
          `### Insight\n${items.length ? `These growth opportunities target ${gap ? `your **${gap.skill}** gap` : `your ${role} direction`}.` : 'No upcoming growth items match yet.'}\n\n` +
          (items.length ? `### Why it matters\n${items.map((i) => `- **${i.title}** (${i.type.toLowerCase().replace('_', ' ')}, ${i.provider}${i.date ? `, ${i.date}` : ''}) — ${i.why}`).join('\n')}\n\n` : '') +
          `### Next best action\n${items[0] ? `Save **${items[0].title}** and block time for it.` : 'Check Discover → Growth next week.'}\n\n### Expected impact\nBuilds Knowledge and closes skill gaps with structured practice.`;
        break;
      }

      case 'books': {
        const books = (await call('search_books', { skill: gap?.skill })) as any[];
        const list = books.length ? books : ((await call('search_books', {})) as any[]);
        content =
          `### Insight\n${list.length ? `Start with **${list[0].title}** by ${list[0].authors.join(', ')}.` : 'No book recommendations yet.'}\n\n` +
          (list.length ? `### Why it matters\n${list.slice(0, 3).map((b) => `- **${b.title}**${b.level ? ` (${b.level})` : ''} — ${b.why}`).join('\n')}\n\n` : '') +
          `### Next best action\nRead one chapter this week and capture one idea in your journal.\n\n### Expected impact\nCompleted books count toward your Knowledge readiness.`;
        break;
      }

      case 'papers': {
        const papers = (await call('search_papers', { skill: gap?.skill })) as any[];
        const list = papers.length ? papers : ((await call('search_papers', {})) as any[]);
        content =
          `### Insight\n${list.length ? `These papers connect directly to your ${role} path.` : 'No papers matched your current gaps.'}\n\n` +
          (list.length ? `### Why it matters\n${list.slice(0, 3).map((p) => `- **${p.title}** (${p.authors.join(', ')}${p.year ? `, ${p.year}` : ''}) — ${p.why}`).join('\n')}\n\n` : '') +
          `### Next best action\nSkim the first paper's abstract and conclusion, then note one practical takeaway.\n\n### Expected impact\nDeepens role knowledge you can cite in interviews.`;
        break;
      }

      case 'people': {
        const people = (await call('find_role_models')) as any[];
        const p = people[0];
        content = p
          ? `### Insight\n${p.insight}\n\n### Why it matters\n- Similarities: ${p.similarities.join(', ') || '—'}\n- Differences: ${p.differences.join(', ') || '—'}\n\n### Next best action\n${p.recommendedAction}\n\n### Expected impact\nLearning from proven trajectories helps you prioritise the experience that matters.`
          : `### Insight\nNo role models matched yet.`;
        break;
      }

      case 'node': {
        const label = page?.label ?? ctx.page?.focus ?? 'this skill';
        const data = await call('analyze_career_gap');
        const g = (data?.gaps ?? []).find((x: any) => x.skill.toLowerCase() === String(label).toLowerCase());
        const jobs = (await call('find_opportunities', { limit: 10 })) as any[];
        const requiring = jobs.filter((j) => j.missing.includes(label) || j.whyYouMatch.includes(label)).length;
        content =
          `### Insight\n**${label}** ${g ? `is a gap for ${role}: level ${g.current} of the ${g.required} required.` : `supports your ${role} path.`}\n\n` +
          `### Why it matters\n- Appears in ${requiring} of your top ${jobs.length} matching opportunities.\n- ${role} roles use it to make and defend decisions.\n\n` +
          `### Next best action\n${g && !g.inJourney ? `Add ${label} to your journey — a confirmation card is below.` : 'Keep building it through your current quest.'}\n\n` +
          `### Expected impact\nImproves Skill Match and your fit for these openings.`;
        break;
      }

      case 'journey': {
        if (page?.entityType === 'quest' && /first|before|should i/.test(message.toLowerCase())) {
          const nba = await call('get_next_best_action');
          content =
            `### Insight\n${nba ? `Orbit's priority right now is **${nba.title}**.` : 'Focus on your in-progress quest first.'}\n\n` +
            `### Why it matters\n${nba?.reason ?? 'Finishing what you started compounds progress.'}\n\n### Next best action\n${nba?.title ?? 'Complete the next open task.'}\n\n### Expected impact\n${nba?.expectedImpact ?? 'Steady readiness gains.'}`;
        } else {
          await call('build_career_journey');
          content = `### Insight\nYour journey turns gaps into milestones and quests.\n\n### Next best action\nConfirm the card below to ${ctx.currentQuest ? 'expand' : 'generate'} your ${role} journey.\n\n### Expected impact\nA clear weekly path toward career readiness.`;
        }
        break;
      }

      case 'reminder': {
        const title = message.replace(/.*\b(remind me to|remind me about|remind me|ingatkan saya untuk|ingatkan)\b/i, '').replace(/\b(tomorrow|besok|next week|in \d+ (days?|hours?)|at \d{1,2}(:\d{2})?\s*(am|pm)?|on monday|next monday|tonight)\b/gi, '').trim() || 'Career check-in';
        const r = await call('create_reminder', { title: title.charAt(0).toUpperCase() + title.slice(1), when: message });
        content = r?.status ? `### Reminder\nI prepared a reminder for **${title}**. Confirm the card below to schedule it.` : `### Reminder\nWhen should I remind you? Try "tomorrow 19:00" or "in 2 days".`;
        break;
      }

      case 'progress': {
        const taskTitle = message.replace(/.*\b(finished|completed|did|done with|sudah selesai)\b/i, '').trim();
        const r = await call('update_progress', { taskTitle });
        content = r?.status ? `### Nice work\nI found the matching task **${r.task}**. Confirm the card below and Orbit will update your quest, XP and readiness.` : `### Progress\nI couldn't match that to an open task. Open your Journey to tick it off directly.`;
        break;
      }
    }

    return { content, toolCalls, actions };
  }
}

function section(insight: string, why: string, next: string, impact: string) {
  return `### Insight\n${insight}\n\n### Why it matters\n${why}\n\n### Next best action\n${next}\n\n### Expected impact\n${impact}`;
}
