import { Controller, Get, Module, Query } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { SearchResult } from '@orbit/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CurrentUser, type AuthUser } from '../../common/auth/auth.decorators';

const PAGES: SearchResult[] = [
  { id: 'page-mission', type: 'PAGE', title: 'Mission Control', subtitle: 'What to focus on today', url: '/app' },
  { id: 'page-universe', type: 'PAGE', title: 'Career Universe', subtitle: 'Your connected career graph', url: '/app/universe' },
  { id: 'page-journey', type: 'PAGE', title: 'Journey', subtitle: 'Milestones and quests', url: '/app/journey' },
  { id: 'page-journal', type: 'PAGE', title: 'Career Journal', subtitle: 'Notes and reflections', url: '/app/journey?view=journal' },
  { id: 'page-discover', type: 'PAGE', title: 'Discover', subtitle: 'Jobs, growth, knowledge and people', url: '/app/discover' },
  { id: 'page-applications', type: 'PAGE', title: 'Applications', subtitle: 'Saved jobs and pipeline', url: '/app/discover/applications' },
  { id: 'page-progress', type: 'PAGE', title: 'Progress', subtitle: 'Readiness history and timeline', url: '/app/progress' },
  { id: 'page-profile', type: 'PAGE', title: 'Profile & Career DNA', subtitle: 'Career Intelligence', url: '/app/profile' },
  { id: 'page-settings', type: 'PAGE', title: 'Settings', subtitle: 'Account and AI status', url: '/app/settings' },
];

class SearchQuery {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
}

@Controller('search')
export class SearchController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async search(@CurrentUser() user: AuthUser, @Query() query: SearchQuery): Promise<SearchResult[]> {
    const q = query.q?.trim() ?? '';
    if (q.length < 2) return PAGES;
    const like = { contains: q, mode: 'insensitive' as const };
    const [nodes, jobs, quests, books, papers, events, resources, people, notes] = await Promise.all([
      this.prisma.graphNode.findMany({ where: { userId: user.id, label: like }, take: 5 }),
      this.prisma.opportunity.findMany({ where: { isActive: true, OR: [{ title: like }, { company: like }] }, take: 5 }),
      this.prisma.quest.findMany({ where: { userId: user.id, title: like }, take: 4 }),
      this.prisma.book.findMany({ where: { title: like }, take: 3 }),
      this.prisma.researchPaper.findMany({ where: { title: like }, take: 3 }),
      this.prisma.event.findMany({ where: { title: like, startsAt: { gte: new Date() } }, take: 3 }),
      this.prisma.resource.findMany({ where: { title: like }, take: 3 }),
      this.prisma.roleModel.findMany({ where: { name: like }, take: 3 }),
      this.prisma.careerNote.findMany({ where: { userId: user.id, OR: [{ title: like }, { content: like }] }, take: 3 }),
    ]);
    const lower = q.toLowerCase();
    return [
      ...PAGES.filter((p) => p.title.toLowerCase().includes(lower)),
      ...nodes.map((n) => ({ id: n.id, type: 'NODE' as const, title: n.label, subtitle: `Universe · ${n.type.replace('_', ' ').toLowerCase()}`, url: `/app/universe?node=${n.id}` })),
      ...jobs.map((j) => ({ id: j.id, type: 'JOB' as const, title: j.title, subtitle: j.company, url: `/app/discover/jobs/${j.id}` })),
      ...quests.map((x) => ({ id: x.id, type: 'QUEST' as const, title: x.title, subtitle: `Quest · ${x.progress}%`, url: `/app/journey?quest=${x.id}` })),
      ...books.map((b) => ({ id: b.id, type: 'BOOK' as const, title: b.title, subtitle: b.authors.join(', '), url: `/app/discover?tab=knowledge&focus=${b.id}` })),
      ...papers.map((p) => ({ id: p.id, type: 'PAPER' as const, title: p.title, subtitle: `${p.authors[0] ?? ''}${p.year ? ` · ${p.year}` : ''}`, url: `/app/discover?tab=knowledge&focus=${p.id}` })),
      ...events.map((e) => ({ id: e.id, type: 'EVENT' as const, title: e.title, subtitle: e.organizer, url: `/app/discover?tab=growth&focus=${e.id}` })),
      ...resources.map((r) => ({ id: r.id, type: 'RESOURCE' as const, title: r.title, subtitle: r.provider, url: `/app/discover?tab=growth&focus=${r.id}` })),
      ...people.map((p) => ({ id: p.id, type: 'PERSON' as const, title: p.name, subtitle: p.headline, url: `/app/discover?tab=people&focus=${p.id}` })),
      ...notes.map((n) => ({ id: n.id, type: 'NOTE' as const, title: n.title, subtitle: 'Career Journal', url: `/app/journey?view=journal&note=${n.id}` })),
    ];
  }
}

@Module({ controllers: [SearchController] })
export class SearchModule {}
