import { Controller, Get, Module, Query } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { SearchResult } from '@orbit/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CurrentUser, type AuthUser } from '../../common/auth/auth.decorators';
import { L } from '../../common/i18n/locale';

/** Built per request so titles follow the user's interface language. */
function pages(): SearchResult[] {
  return [
    { id: 'page-mission', type: 'PAGE', title: 'Mission Control', subtitle: L('What to focus on today', 'Fokusmu hari ini'), url: '/app' },
    { id: 'page-universe', type: 'PAGE', title: 'Career Universe', subtitle: L('Your connected career graph', 'Graf kariermu yang saling terhubung'), url: '/app/universe' },
    { id: 'page-journey', type: 'PAGE', title: 'Journey', subtitle: L('Milestones and quests', 'Milestone dan quest'), url: '/app/journey' },
    { id: 'page-journal', type: 'PAGE', title: L('Career Journal', 'Jurnal Karier'), subtitle: L('Notes and reflections', 'Catatan dan refleksi'), url: '/app/journey?view=journal' },
    { id: 'page-orbits', type: 'PAGE', title: L('My Orbits', 'Orbit-ku'), subtitle: L('Compare career paths', 'Bandingkan jalur karier'), url: '/app/journey?view=orbits' },
    { id: 'page-discover', type: 'PAGE', title: L('Discover', 'Jelajahi'), subtitle: L('Jobs, growth, knowledge and people', 'Lowongan, pengembangan, pengetahuan, dan tokoh'), url: '/app/discover' },
    { id: 'page-applications', type: 'PAGE', title: L('Applications', 'Lamaran'), subtitle: L('Saved jobs and pipeline', 'Lowongan tersimpan dan alur lamaran'), url: '/app/discover/applications' },
    { id: 'page-progress', type: 'PAGE', title: L('Progress', 'Progres'), subtitle: L('Readiness history and timeline', 'Riwayat kesiapan dan linimasa'), url: '/app/progress' },
    { id: 'page-profile', type: 'PAGE', title: L('Profile & Career DNA', 'Profil & Career DNA'), subtitle: 'Career Intelligence', url: '/app/profile' },
    { id: 'page-guide', type: 'PAGE', title: L('Guide', 'Panduan'), subtitle: L('How to use Orbit', 'Cara menggunakan Orbit'), url: '/app/guide' },
    { id: 'page-settings', type: 'PAGE', title: L('Settings', 'Pengaturan'), subtitle: L('Account, language and AI status', 'Akun, bahasa, dan status AI'), url: '/app/settings' },
  ];
}

class SearchQuery {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
}

@Controller('search')
export class SearchController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async search(@CurrentUser() user: AuthUser, @Query() query: SearchQuery): Promise<SearchResult[]> {
    const q = query.q?.trim() ?? '';
    const PAGES = pages();
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
      ...notes.map((n) => ({ id: n.id, type: 'NOTE' as const, title: n.title, subtitle: L('Career Journal', 'Jurnal Karier'), url: `/app/journey?view=journal&note=${n.id}` })),
    ];
  }
}

@Module({ controllers: [SearchController] })
export class SearchModule {}
