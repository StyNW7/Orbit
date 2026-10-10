import { Injectable } from '@nestjs/common';
import type { AgentAction } from '@prisma/client';
import type { AgentPageContext, AgentToolName, ToolCallView } from '@orbit/shared';
import { L } from '../../common/i18n/locale';
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

/** English and Bahasa Indonesia phrasings both route to the same intent. */
export function detectIntent(message: string, page?: AgentPageContext): Intent {
  const m = message.toLowerCase();
  if (/\b(remind|reminder|ingatkan|pengingat)\b/.test(m)) return 'reminder';
  if (/\b(i (just )?(finished|completed|did)|i'?m done with|sudah selesai|aku (sudah )?selesai|saya (sudah )?selesai)\b/.test(m)) return 'progress';
  if (/(ready to apply|am i ready|should i apply|siap melamar|sudah siap|siap untuk melamar|layak melamar)/.test(m)) return page?.entityType === 'job' || page?.entityType === 'application' ? 'job_readiness' : 'jobs';
  if (/(focus|this week|minggu ini|fokus|prioriti[sz]e|prioritas|what should i (do|work)|next step|langkah (selanjutnya|berikutnya)|where (do|should) i start|mulai dari mana)/.test(m)) return 'focus';
  if (/\b(job|jobs|intern|internship|opportunit\w*|vacanc\w*|lowongan|magang|pekerjaan|kerja|position|role openings)\b/.test(m)) return 'jobs';
  if (/\b(paper|papers|research|jurnal ilmiah|riset|penelitian|journal article|study)\b/.test(m)) return 'papers';
  if (/\b(book|books|buku|read|bacaan)\b/.test(m)) return 'books';
  if (/\b(course|courses|kursus|kelas|event|events|acara|workshop|seminar|certif\w*|sertifikasi|hackathon|competition|kompetisi|lomba|bootcamp|conference|konferensi)\b/.test(m)) return 'growth';
  if (/\b(mentor|role model|inspir\w*|people like me|tokoh|panutan|who should i learn)\b/.test(m)) return 'people';
  if (/\b(why|important|matter|kenapa|mengapa|penting)\b/.test(m) && page?.entityType === 'node') return 'node';
  if (/\b(gap|gaps|missing|weak|improve|kurang|lacking|kekurangan|tingkatkan|lemah)\b/.test(m)) return 'gaps';
  if (/\b(journey|roadmap|plan|rencana|quest|milestone)\b/.test(m)) return 'journey';
  return 'overview';
}

/** Section headings in the active language — the same four-part structure the LLM uses. */
const H = {
  insight: () => '### Insight',
  why: () => L('### Why it matters', '### Kenapa ini penting'),
  next: () => L('### Next best action', '### Langkah terbaik berikutnya'),
  impact: () => L('### Expected impact', '### Dampak yang diharapkan'),
  week: () => L('### This week', '### Minggu ini'),
};

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

    const role = ctx.targetRole ?? L('your target role', 'target peranmu');
    const gap = ctx.topGaps[0];
    const intent = detectIntent(message, page);
    let content: string;

    if (!ctx.targetRole && intent !== 'reminder') {
      content = section(
        L('Orbit needs a target role to guide you.', 'Orbit membutuhkan target peran untuk membimbingmu.'),
        L('Readiness, gaps and recommendations are all measured against the career you are aiming for.', 'Kesiapan, gap, dan rekomendasi semuanya diukur terhadap karier yang kamu tuju.'),
        L('Finish onboarding: choose a target role and upload your CV.', 'Selesaikan onboarding: pilih target peran dan unggah CV-mu.'),
        L('Unlocks Career Intelligence, your Career Universe and a personalised journey.', 'Membuka Career Intelligence, Career Universe, dan journey yang dipersonalisasi.'),
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
        if (gap) why.push(L(`**${gap.skill}** is your largest ${role} gap (level ${gap.current} of ${gap.required}).`, `**${gap.skill}** adalah gap terbesarmu untuk ${role} (level ${gap.current} dari ${gap.required}).`));
        if (ctx.currentQuest)
          why.push(
            L(
              `Your current quest **${ctx.currentQuest.title}** is ${ctx.currentQuest.progress}% complete${ctx.currentQuest.nextTask ? ` — next task: *${ctx.currentQuest.nextTask}*` : ''}.`,
              `Quest-mu saat ini **${ctx.currentQuest.title}** sudah ${ctx.currentQuest.progress}% selesai${ctx.currentQuest.nextTask ? ` — tugas berikutnya: *${ctx.currentQuest.nextTask}*` : ''}.`,
            ),
          );
        if (app) {
          const left = app.daysLeft !== null ? L(` (${app.daysLeft} day${app.daysLeft === 1 ? '' : 's'} left)`, ` (${app.daysLeft} hari lagi)`) : '';
          why.push(
            L(
              `**${app.role}** at ${app.company} is in *${app.stage.toLowerCase()}*${app.deadline ? `, deadline ${app.deadline}${left}` : ''}.`,
              `Lamaran **${app.role}** di ${app.company} berstatus *${app.stage.toLowerCase()}*${app.deadline ? `, tenggat ${app.deadline}${left}` : ''}.`,
            ),
          );
        }
        if (ctx.careerReadiness !== null)
          why.push(
            L(
              `Career Readiness is **${ctx.careerReadiness}%**${weakest ? `; ${weakest[0]} is your lowest category (${weakest[1]}).` : '.'}`,
              `Kesiapan Karier-mu **${ctx.careerReadiness}%**${weakest ? `; ${weakest[0]} adalah kategori terendahmu (${weakest[1]}).` : '.'}`,
            ),
          );
        if (ctx.recentInsights[0]) why.push(L(`Recent insight: ${ctx.recentInsights[0]}`, `Insight terbaru: ${ctx.recentInsights[0]}`));

        const plan: string[] = [];
        if (ctx.currentQuest?.nextTask) plan.push(`| ${L('Early week', 'Awal minggu')} | ${ctx.currentQuest.nextTask} |`);
        if (app && ['SAVED', 'PREPARING'].includes(app.stage))
          plan.push(`| ${L('Mid-week', 'Pertengahan minggu')} | ${L(`Finish and submit the ${app.company} application${app.deadline ? ` before ${app.deadline}` : ''}`, `Selesaikan dan kirim lamaran ke ${app.company}${app.deadline ? ` sebelum ${app.deadline}` : ''}`)} |`);
        else if (app?.stage === 'INTERVIEW') plan.push(`| ${L('Mid-week', 'Pertengahan minggu')} | ${L(`Run a mock interview for ${app.company}`, `Lakukan simulasi interview untuk ${app.company}`)} |`);
        if (gap && !gap.inJourney) plan.push(`| ${L('Any day', 'Kapan saja')} | ${L(`Add ${gap.skill} to your journey and start its first task`, `Tambahkan ${gap.skill} ke journey-mu dan mulai tugas pertamanya`)} |`);
        plan.push(`| ${L('Weekend', 'Akhir pekan')} | ${L('Write a short reflection in your Career Journal', 'Tulis refleksi singkat di Jurnal Karier-mu')} |`);

        const urgentApp = app && ['SAVED', 'PREPARING'].includes(app.stage);
        content =
          `${H.insight()}\n` +
          (intent === 'focus'
            ? L(
                `This week, your highest-leverage focus is **${focusTopic}**${urgentApp ? `, while keeping the **${app.company}** application on track` : ''}.\n\n`,
                `Minggu ini, fokus dengan dampak terbesar untukmu adalah **${focusTopic}**${urgentApp ? `, sambil menjaga lamaran ke **${app.company}** tetap sesuai jadwal` : ''}.\n\n`,
              )
            : L(
                `You are ${ctx.careerReadiness ?? '—'}% ready for **${role}**. ${gap ? `${gap.skill} is the gap that matters most right now.` : 'Your core skills are in place.'}\n\n`,
                `Kamu ${ctx.careerReadiness ?? '—'}% siap untuk **${role}**. ${gap ? `${gap.skill} adalah gap yang paling penting saat ini.` : 'Skill intimu sudah terpenuhi.'}\n\n`,
              )) +
          `${H.why()}\n${why.map((w) => `- ${w}`).join('\n')}\n\n` +
          `${H.next()}\n${nba ? `**${nba.title}** — ${nba.reason}` : L('Keep progressing your current quest.', 'Lanjutkan progres quest-mu saat ini.')}\n\n` +
          (intent === 'focus' ? `${H.week()}\n| ${L('When', 'Kapan')} | ${L('Focus', 'Fokus')} |\n|---|---|\n${plan.join('\n')}\n\n` : '') +
          `${H.impact()}\n${nba?.expectedImpact ?? L('Steady progress toward career readiness.', 'Progres yang stabil menuju kesiapan karier.')}`;
        break;
      }

      case 'gaps': {
        const data = await call('analyze_career_gap');
        const gaps: { skill: string; current: number; required: number; inJourney: boolean }[] = data?.gaps ?? [];
        const yes = L('Yes', 'Ya');
        const no = L('No', 'Belum');
        content =
          `${H.insight()}\n${
            gaps.length
              ? L(
                  `You have ${gaps.length} open skill gap${gaps.length === 1 ? '' : 's'} for **${data.role}**. The biggest is **${gaps[0].skill}**.`,
                  `Kamu punya ${gaps.length} gap skill terbuka untuk **${data.role}**. Yang terbesar adalah **${gaps[0].skill}**.`,
                )
              : L(`You meet the core skill requirements for **${data?.role ?? role}**.`, `Kamu sudah memenuhi kebutuhan skill inti untuk **${data?.role ?? role}**.`)
          }\n\n` +
          (gaps.length
            ? `${H.why()}\n| ${L('Skill', 'Skill')} | ${L('Current', 'Saat ini')} | ${L('Required', 'Dibutuhkan')} | ${L('In journey', 'Di journey')} |\n|---|---|---|---|\n${gaps.map((g) => `| ${g.skill} | ${g.current} | ${g.required} | ${g.inJourney ? yes : no} |`).join('\n')}\n\n`
            : '') +
          `${H.next()}\n${
            gaps[0]
              ? gaps[0].inJourney
                ? L(`Keep going with your ${gaps[0].skill} quest.`, `Lanjutkan quest ${gaps[0].skill}-mu.`)
                : L(`Add **${gaps[0].skill}** to your journey — a confirmation card is below.`, `Tambahkan **${gaps[0].skill}** ke journey-mu — kartu konfirmasi ada di bawah.`)
              : L('Shift focus to portfolio and applications.', 'Alihkan fokus ke portofolio dan lamaran.')
          }\n\n` +
          `${H.impact()}\n${L('Closing the top gap raises Skill Match, the largest readiness category (30%).', 'Menutup gap teratas akan menaikkan Kecocokan Skill, kategori kesiapan terbesar (30%).')}`;
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
              `${H.insight()}\n${
                ready
                  ? L(`Yes — you are a strong candidate for **${job.title}** (${job.match}% match).`, `Ya — kamu kandidat yang kuat untuk **${job.title}** (${job.match}% cocok).`)
                  : L(
                      `You are a partial match for **${job.title}** (${job.match}%). You can apply, but strengthen a few areas first.`,
                      `Kamu cukup cocok untuk **${job.title}** (${job.match}%). Kamu bisa melamar, tetapi perkuat beberapa area terlebih dulu.`,
                    )
              }\n\n` +
              `${H.why()}\n- ${L('Why you match', 'Kenapa kamu cocok')}: ${job.whyYouMatch.join(', ') || L('relevant background', 'latar belakang yang relevan')}\n- ${L('Missing', 'Yang kurang')}: ${job.missing.join(', ') || L('nothing critical', 'tidak ada yang kritis')}\n${job.deadline ? `- ${L('Deadline', 'Tenggat')}: ${job.deadline}\n` : ''}\n` +
              `${H.next()}\n${
                job.missing[0]
                  ? L(`Add **${job.missing[0]}** to your journey and mention related projects in your CV.`, `Tambahkan **${job.missing[0]}** ke journey-mu dan cantumkan proyek terkait di CV-mu.`)
                  : L('Tailor your CV and apply this week.', 'Sesuaikan CV-mu dan lamar minggu ini.')
              }\n\n` +
              `${H.impact()}\n${L(
                `A tailored application lifts Application Readiness; closing ${job.missing[0] ?? 'gaps'} lifts Skill Match.`,
                `Lamaran yang disesuaikan menaikkan Kesiapan Lamaran; menutup ${job.missing[0] ?? 'gap'} menaikkan Kecocokan Skill.`,
              )}`;
            break;
          }
        }
        const type = /intern|magang/.test(message.toLowerCase()) ? 'INTERNSHIP' : undefined;
        const jobs = (await call('find_opportunities', { type, limit: 5 })) as any[];
        content = jobs.length
          ? `${H.insight()}\n${L(
              `Orbit found ${jobs.length} opportunities aligned with **${role}**. The strongest is **${jobs[0].title}** at ${jobs[0].company} (${jobs[0].match}% match).`,
              `Orbit menemukan ${jobs.length} peluang yang selaras dengan **${role}**. Yang paling kuat adalah **${jobs[0].title}** di ${jobs[0].company} (${jobs[0].match}% cocok).`,
            )}\n\n` +
            `${H.why()}\n| ${L('Role', 'Peran')} | ${L('Company', 'Perusahaan')} | ${L('Match', 'Kecocokan')} | ${L('Missing', 'Yang kurang')} |\n|---|---|---|---|\n${jobs.map((j) => `| ${j.title} | ${j.company} | ${j.match}% | ${j.missing.slice(0, 2).join(', ') || '—'} |`).join('\n')}\n\n` +
            `${H.next()}\n${L(
              `Save **${jobs[0].title}** so Orbit tracks its deadline${jobs[0].deadline ? ` (${jobs[0].deadline})` : ''}.`,
              `Simpan **${jobs[0].title}** agar Orbit memantau tenggatnya${jobs[0].deadline ? ` (${jobs[0].deadline})` : ''}.`,
            )}\n\n` +
            `${H.impact()}\n${L('A saved, prepared application moves Application Readiness forward.', 'Lamaran yang disimpan dan dipersiapkan akan menaikkan Kesiapan Lamaran.')}`
          : `${H.insight()}\n${L("We're still mapping opportunities that match your Orbit.", 'Kami masih memetakan peluang yang cocok dengan Orbit-mu.')}\n\n${H.next()}\n${L(
              'Refresh opportunities in Discover or broaden your work-mode preferences.',
              'Segarkan peluang di halaman Jelajahi atau perluas preferensi mode kerjamu.',
            )}`;
        break;
      }

      case 'growth': {
        const items = (await call('search_growth_resources', { skill: gap?.skill, limit: 5 })) as any[];
        content =
          `${H.insight()}\n${
            items.length
              ? L(`These growth opportunities target ${gap ? `your **${gap.skill}** gap` : `your ${role} direction`}.`, `Peluang pengembangan ini menyasar ${gap ? `gap **${gap.skill}**-mu` : `arah ${role}-mu`}.`)
              : L('No upcoming growth items match yet.', 'Belum ada kegiatan pengembangan mendatang yang cocok.')
          }\n\n` +
          (items.length ? `${H.why()}\n${items.map((i) => `- **${i.title}** (${i.type.toLowerCase().replace('_', ' ')}, ${i.provider}${i.date ? `, ${i.date}` : ''}) — ${i.why}`).join('\n')}\n\n` : '') +
          `${H.next()}\n${items[0] ? L(`Save **${items[0].title}** and block time for it.`, `Simpan **${items[0].title}** dan sisihkan waktu untuknya.`) : L('Check Discover → Growth next week.', 'Cek Jelajahi → Pengembangan minggu depan.')}\n\n${H.impact()}\n${L(
            'Builds Knowledge and closes skill gaps with structured practice.',
            'Membangun Pengetahuan dan menutup gap skill lewat latihan yang terstruktur.',
          )}`;
        break;
      }

      case 'books': {
        const books = (await call('search_books', { skill: gap?.skill })) as any[];
        const list = books.length ? books : ((await call('search_books', {})) as any[]);
        content =
          `${H.insight()}\n${list.length ? L(`Start with **${list[0].title}** by ${list[0].authors.join(', ')}.`, `Mulailah dengan **${list[0].title}** karya ${list[0].authors.join(', ')}.`) : L('No book recommendations yet.', 'Belum ada rekomendasi buku.')}\n\n` +
          (list.length ? `${H.why()}\n${list.slice(0, 3).map((b) => `- **${b.title}**${b.level ? ` (${b.level})` : ''} — ${b.why}`).join('\n')}\n\n` : '') +
          `${H.next()}\n${L('Read one chapter this week and capture one idea in your journal.', 'Baca satu bab minggu ini dan catat satu ide di jurnalmu.')}\n\n${H.impact()}\n${L(
            'Completed books count toward your Knowledge readiness.',
            'Buku yang selesai dibaca dihitung dalam kesiapan Pengetahuanmu.',
          )}`;
        break;
      }

      case 'papers': {
        const papers = (await call('search_papers', { skill: gap?.skill })) as any[];
        const list = papers.length ? papers : ((await call('search_papers', {})) as any[]);
        content =
          `${H.insight()}\n${list.length ? L(`These papers connect directly to your ${role} path.`, `Jurnal ilmiah ini terhubung langsung dengan jalur ${role}-mu.`) : L('No papers matched your current gaps.', 'Belum ada jurnal ilmiah yang cocok dengan gap-mu saat ini.')}\n\n` +
          (list.length ? `${H.why()}\n${list.slice(0, 3).map((p) => `- **${p.title}** (${p.authors.join(', ')}${p.year ? `, ${p.year}` : ''}) — ${p.why}`).join('\n')}\n\n` : '') +
          `${H.next()}\n${L("Skim the first paper's abstract and conclusion, then note one practical takeaway.", 'Baca sekilas abstrak dan kesimpulan jurnal pertama, lalu catat satu pelajaran praktis.')}\n\n${H.impact()}\n${L(
            'Deepens role knowledge you can cite in interviews.',
            'Memperdalam pemahaman peran yang bisa kamu sebutkan saat interview.',
          )}`;
        break;
      }

      case 'people': {
        const people = (await call('find_role_models')) as any[];
        const p = people[0];
        content = p
          ? `${H.insight()}\n${p.insight}\n\n${H.why()}\n- ${L('Similarities', 'Kesamaan')}: ${p.similarities.join(', ') || '—'}\n- ${L('Differences', 'Perbedaan')}: ${p.differences.join(', ') || '—'}\n\n${H.next()}\n${p.recommendedAction}\n\n${H.impact()}\n${L(
              'Learning from proven trajectories helps you prioritise the experience that matters.',
              'Belajar dari perjalanan karier yang terbukti membantumu memprioritaskan pengalaman yang penting.',
            )}`
          : `${H.insight()}\n${L('No role models matched yet.', 'Belum ada role model yang cocok.')}`;
        break;
      }

      case 'node': {
        const label = page?.label ?? ctx.page?.focus ?? L('this skill', 'skill ini');
        const data = await call('analyze_career_gap');
        const g = (data?.gaps ?? []).find((x: any) => x.skill.toLowerCase() === String(label).toLowerCase());
        const jobs = (await call('find_opportunities', { limit: 10 })) as any[];
        const requiring = jobs.filter((j) => j.missing.includes(label) || j.whyYouMatch.includes(label)).length;
        content =
          `${H.insight()}\n**${label}** ${g ? L(`is a gap for ${role}: level ${g.current} of the ${g.required} required.`, `adalah gap untuk ${role}: level ${g.current} dari ${g.required} yang dibutuhkan.`) : L(`supports your ${role} path.`, `mendukung jalur ${role}-mu.`)}\n\n` +
          `${H.why()}\n- ${L(`Appears in ${requiring} of your top ${jobs.length} matching opportunities.`, `Muncul di ${requiring} dari ${jobs.length} peluang teratas yang cocok denganmu.`)}\n- ${L(`${role} roles use it to make and defend decisions.`, `Peran ${role} memakainya untuk mengambil dan mempertanggungjawabkan keputusan.`)}\n\n` +
          `${H.next()}\n${g && !g.inJourney ? L(`Add ${label} to your journey — a confirmation card is below.`, `Tambahkan ${label} ke journey-mu — kartu konfirmasi ada di bawah.`) : L('Keep building it through your current quest.', 'Terus kembangkan lewat quest-mu saat ini.')}\n\n` +
          `${H.impact()}\n${L('Improves Skill Match and your fit for these openings.', 'Meningkatkan Kecocokan Skill dan kesesuaianmu dengan lowongan tersebut.')}`;
        break;
      }

      case 'journey': {
        if (page?.entityType === 'quest' && /first|before|should i|dulu|duluan|lebih dulu|haruskah|sebaiknya/.test(message.toLowerCase())) {
          const nba = await call('get_next_best_action');
          content =
            `${H.insight()}\n${nba ? L(`Orbit's priority right now is **${nba.title}**.`, `Prioritas Orbit saat ini adalah **${nba.title}**.`) : L('Focus on your in-progress quest first.', 'Fokus dulu pada quest yang sedang berjalan.')}\n\n` +
            `${H.why()}\n${nba?.reason ?? L('Finishing what you started compounds progress.', 'Menyelesaikan apa yang sudah dimulai akan melipatgandakan progres.')}\n\n${H.next()}\n${nba?.title ?? L('Complete the next open task.', 'Selesaikan tugas terbuka berikutnya.')}\n\n${H.impact()}\n${
              nba?.expectedImpact ?? L('Steady readiness gains.', 'Kenaikan kesiapan yang stabil.')
            }`;
        } else {
          await call('build_career_journey');
          content = `${H.insight()}\n${L('Your journey turns gaps into milestones and quests.', 'Journey-mu mengubah gap menjadi milestone dan quest.')}\n\n${H.next()}\n${L(
            `Confirm the card below to ${ctx.currentQuest ? 'expand' : 'generate'} your ${role} journey.`,
            `Konfirmasi kartu di bawah untuk ${ctx.currentQuest ? 'memperluas' : 'membuat'} journey ${role}-mu.`,
          )}\n\n${H.impact()}\n${L('A clear weekly path toward career readiness.', 'Jalur mingguan yang jelas menuju kesiapan karier.')}`;
        }
        break;
      }

      case 'reminder': {
        const title =
          message
            .replace(/.*\b(remind me to|remind me about|remind me|ingatkan (aku|saya) untuk|ingatkan (aku|saya) tentang|ingatkan (aku|saya)|ingatkan)\b/i, '')
            .replace(/\b(tomorrow|besok|next week|minggu depan|(in|dalam) \d+ (days?|hours?|hari|jam)( lagi)?|\d+ (hari|jam) lagi|at \d{1,2}(:\d{2})?\s*(am|pm)?|(jam|pukul) \d{1,2}([:.]\d{2})?|on monday|next monday|senin|tonight|malam ini)\b/gi, '')
            .trim() || L('Career check-in', 'Cek progres karier');
        const r = await call('create_reminder', { title: title.charAt(0).toUpperCase() + title.slice(1), when: message });
        content = r?.status
          ? `### ${L('Reminder', 'Pengingat')}\n${L(`I prepared a reminder for **${title}**. Confirm the card below to schedule it.`, `Aku sudah menyiapkan pengingat untuk **${title}**. Konfirmasi kartu di bawah untuk menjadwalkannya.`)}`
          : `### ${L('Reminder', 'Pengingat')}\n${L('When should I remind you? Try "tomorrow 19:00" or "in 2 days".', 'Kapan aku harus mengingatkanmu? Coba "besok jam 19:00" atau "dalam 2 hari".')}`;
        break;
      }

      case 'progress': {
        const taskTitle = message.replace(/.*\b(finished|completed|did|done with|sudah selesai|selesai)\b/i, '').trim();
        const r = await call('update_progress', { taskTitle });
        content = r?.status
          ? `### ${L('Nice work', 'Kerja bagus')}\n${L(
              `I found the matching task **${r.task}**. Confirm the card below and Orbit will update your quest, XP and readiness.`,
              `Aku menemukan tugas yang cocok: **${r.task}**. Konfirmasi kartu di bawah dan Orbit akan memperbarui quest, XP, dan kesiapanmu.`,
            )}`
          : `### ${L('Progress', 'Progres')}\n${L("I couldn't match that to an open task. Open your Journey to tick it off directly.", 'Aku tidak menemukan tugas terbuka yang cocok. Buka Journey-mu untuk mencentangnya langsung.')}`;
        break;
      }
    }

    return { content, toolCalls, actions };
  }
}

function section(insight: string, why: string, next: string, impact: string) {
  return `${H.insight()}\n${insight}\n\n${H.why()}\n${why}\n\n${H.next()}\n${next}\n\n${H.impact()}\n${impact}`;
}
