import { Body, Controller, Delete, Get, Injectable, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { NoteType } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { XP_REWARDS, normalizeTerm, type InsightView, type NoteView } from '@orbit/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { notFound } from '../../common/http/errors';
import { toInsightView, toNoteView } from '../../common/mappers';
import { CurrentUser, type AuthUser } from '../../common/auth/auth.decorators';
import { SKILLS } from '../../catalog/skills.catalog';
import { escapeRegExp } from '../ai/embedding.service';
import { UsersService } from '../users/users.service';

const DIFFICULTY =
  /(struggl|difficult|hard time|hard to|confus|not confident|unsure|weak|couldn'?t|could not|didn'?t know|did not know|stuck|blank|kesulitan|bingung|lack|nervous about|unclear)/i;
const PATTERN_THRESHOLD = 3;
const LOOKBACK_NOTES = 12;

const ALIAS_PATTERNS = SKILLS.flatMap((s) =>
  [s.name.toLowerCase(), ...s.aliases]
    .map((a) => normalizeTerm(a))
    .filter((a) => a.length >= 3 && !['lead', 'led', 'api', 'query', 'node', 'analysis', 'writing', 'cloud', 'pitch'].includes(a))
    .map((alias) => ({ slug: s.slug, alias, re: new RegExp(`(?<![a-z0-9])${escapeRegExp(alias)}(?![a-z0-9])`) })),
);

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bAnd\b/g, 'and');

export interface DetectedPattern {
  slug: string;
  label: string;
  noteIds: string[];
  noteTitles: string[];
}

/** Find topics that repeatedly appear next to difficulty language in recent notes. Pure. */
export function detectDifficultyPatterns(notes: { id: string; title: string; content: string }[], threshold = PATTERN_THRESHOLD): DetectedPattern[] {
  const bySlug = new Map<string, { notes: Map<string, string>; aliases: Map<string, number> }>();
  for (const note of notes) {
    const sentences = `${note.title}. ${note.content}`.split(/(?<=[.!?\n])\s+/);
    for (const sentence of sentences) {
      if (!DIFFICULTY.test(sentence)) continue;
      const text = normalizeTerm(sentence);
      for (const { slug, alias, re } of ALIAS_PATTERNS) {
        if (!re.test(text)) continue;
        const entry = bySlug.get(slug) ?? { notes: new Map(), aliases: new Map() };
        entry.notes.set(note.id, note.title);
        entry.aliases.set(alias, (entry.aliases.get(alias) ?? 0) + 1);
        bySlug.set(slug, entry);
      }
    }
  }
  return [...bySlug.entries()]
    .filter(([, v]) => v.notes.size >= threshold)
    .map(([slug, v]) => {
      const alias = [...v.aliases.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0];
      return { slug, label: titleCase(alias), noteIds: [...v.notes.keys()], noteTitles: [...v.notes.values()] };
    })
    .sort((a, b) => b.noteIds.length - a.noteIds.length);
}

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async list(userId: string, q?: string, type?: NoteType): Promise<NoteView[]> {
    const notes = await this.prisma.careerNote.findMany({
      where: {
        userId,
        ...(type ? { type } : {}),
        ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { content: { contains: q, mode: 'insensitive' } }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return notes.map(toNoteView);
  }

  async create(userId: string, data: { type: NoteType; title: string; content: string; tags?: string[] }) {
    const note = await this.prisma.careerNote.create({ data: { userId, ...data, tags: data.tags ?? [] } });
    await this.users.award(userId, { type: 'NOTE_WRITTEN', title: note.title, xp: XP_REWARDS.NOTE_WRITTEN });
    const patterns = await this.refreshPatterns(userId);
    return { note: toNoteView(note), patterns };
  }

  async update(userId: string, id: string, data: Partial<{ type: NoteType; title: string; content: string; tags: string[] }>) {
    const owned = await this.prisma.careerNote.findFirst({ where: { id, userId } });
    if (!owned) throw notFound('Note');
    const note = await this.prisma.careerNote.update({ where: { id }, data });
    const patterns = await this.refreshPatterns(userId);
    return { note: toNoteView(note), patterns };
  }

  async remove(userId: string, id: string) {
    const owned = await this.prisma.careerNote.findFirst({ where: { id, userId } });
    if (!owned) throw notFound('Note');
    await this.prisma.careerNote.delete({ where: { id } });
    return { removed: true };
  }

  async patterns(userId: string): Promise<InsightView[]> {
    const rows = await this.prisma.agentInsight.findMany({ where: { userId, type: 'PATTERN', status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } });
    return rows.map(toInsightView);
  }

  /** Detect recurring difficulties and store them as insights. Never modifies the journey itself. */
  async refreshPatterns(userId: string): Promise<InsightView[]> {
    const notes = await this.prisma.careerNote.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: LOOKBACK_NOTES });
    for (const p of detectDifficultyPatterns(notes)) {
      const message = `${p.label} appeared as a difficulty in ${p.noteIds.length} recent notes.`;
      const suggestedAction = {
        label: `Add “Master ${p.label}” to Journey`,
        type: 'ADD_QUEST',
        payload: {
          title: `Master ${p.label}`,
          description: `Turn a recurring difficulty into a strength: focused practice on ${p.label.toLowerCase()}.`,
          category: 'SKILL',
          skillSlug: p.slug,
          tasks: [`Review the fundamentals of ${p.label.toLowerCase()}`, 'Work through three practice problems', 'Explain the concept in your own words in a note', 'Apply it in your current project or quest'],
        },
      };
      await this.prisma.agentInsight.upsert({
        where: { userId_dedupeKey: { userId, dedupeKey: `pattern:${p.slug}` } },
        update: { message, evidence: p.noteTitles },
        create: { userId, type: 'PATTERN', dedupeKey: `pattern:${p.slug}`, title: 'Pattern detected', message, evidence: p.noteTitles, suggestedAction },
      });
    }
    return this.patterns(userId);
  }
}

class NoteDto {
  @IsEnum(NoteType) type!: NoteType;
  @IsString() @MinLength(2) @MaxLength(140) title!: string;
  @IsString() @MinLength(2) @MaxLength(8000) content!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) tags?: string[];
}

class UpdateNoteDto {
  @IsOptional() @IsEnum(NoteType) type?: NoteType;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(140) title?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(8000) content?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) tags?: string[];
}

class NotesQuery {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @IsEnum(NoteType) type?: NoteType;
}

@Controller('notes')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: NotesQuery) {
    return this.notes.list(user.id, query.q, query.type);
  }

  @Get('patterns')
  patterns(@CurrentUser() user: AuthUser) {
    return this.notes.patterns(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: NoteDto) {
    return this.notes.create(user.id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateNoteDto) {
    return this.notes.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notes.remove(user.id, id);
  }
}

@Module({ controllers: [NotesController], providers: [NotesService], exports: [NotesService] })
export class NotesModule {}
