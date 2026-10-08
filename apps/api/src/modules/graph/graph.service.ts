import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EdgeRelationship, GraphNode, NodeType, Prisma } from '@prisma/client';
import { skillLevelLabel, type GraphNodeView, type NextBestAction, type NodeDetail, type UniverseGraph } from '@orbit/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { badRequest, notFound } from '../../common/http/errors';
import { questTemplateForSkill } from '../../catalog/roles.catalog';
import { SKILLS } from '../../catalog/skills.catalog';
import { CareerContextService, type CareerContext } from '../career/career-context.service';
import { ReadinessService } from '../career/readiness.service';
import { DiscoverService } from '../discover/discover.service';
import { buildCareerGraph, type BuilderInput, type BuilderSkill, type BuiltGraph } from './graph.builder';

const SKILL_SLUG_BY_NAME = new Map(SKILLS.map((s) => [s.name, s.slug]));
const SUBMITTED: string[] = ['APPLIED', 'ASSESSMENT', 'INTERVIEW', 'OFFER'];
const RECOMMENDATION_TYPES: NodeType[] = ['OPPORTUNITY', 'EVENT', 'COURSE', 'BOOK', 'PAPER', 'ROLE_MODEL', 'MENTOR'];

@Injectable()
export class GraphService {
  private readonly logger = new Logger('CareerGraph');

  constructor(
    private readonly prisma: PrismaService,
    private readonly context: CareerContextService,
    private readonly readiness: ReadinessService,
    private readonly discover: DiscoverService,
  ) {}

  // -------------------------------------------------------------------------
  // Build & persist
  // -------------------------------------------------------------------------

  async rebuild(userId: string, options: { ctx?: CareerContext; withRecommendations?: boolean } = {}): Promise<{ nodes: number; edges: number }> {
    const ctx = options.ctx ?? (await this.context.load(userId));
    const input = await this.builderInput(ctx, options.withRecommendations ?? true);
    const built = buildCareerGraph(input);
    await this.persist(userId, built);
    return { nodes: built.nodes.length, edges: built.edges.length };
  }

  private async builderInput(ctx: CareerContext, withRecommendations: boolean): Promise<BuilderInput> {
    const goal = ctx.primaryGoal;
    const requirements = new Map(goal?.role.requirements.map((r) => [r.skillId, r]) ?? []);
    const skillIds = new Set<string>([...requirements.keys(), ...ctx.userSkills.map((u) => u.skillId)]);
    const skills: BuilderSkill[] = [...skillIds]
      .map((id): BuilderSkill | null => {
        const skill = ctx.skillById.get(id);
        if (!skill) return null;
        const req = requirements.get(id);
        return {
          skillId: id,
          slug: skill.slug,
          name: skill.name,
          category: skill.category,
          level: ctx.skillLevels.get(id) ?? 0,
          requiredLevel: req?.requiredLevel ?? null,
          importance: req?.importance ?? null,
        };
      })
      .filter((s): s is BuilderSkill => s !== null);

    const journeyId = goal?.journey?.id;
    const milestones = journeyId
      ? await this.prisma.milestone.findMany({ where: { journeyId }, include: { quests: { select: { progress: true } } }, orderBy: { order: 'asc' } })
      : [];
    const milestoneIds = new Set(milestones.map((m) => m.id));
    const quests = ctx.quests.filter((q) => milestoneIds.has(q.milestoneId));

    const base: BuilderInput = {
      user: { id: ctx.user.id, name: ctx.user.name, headline: ctx.profile?.headline ?? null },
      primaryRole: goal ? { slug: goal.role.slug, title: goal.role.title, description: goal.role.description } : null,
      otherRoles: ctx.goals
        .filter((g) => g.id !== goal?.id)
        .map((g) => ({ slug: g.role.slug, title: g.role.title, requirementSlugs: g.role.requirements.slice(0, 5).map((r) => r.skill.slug) })),
      skills,
      experiences: ctx.experiences.map((e) => ({ id: e.id, type: e.type, title: e.title, organization: e.organization, skills: e.skills })),
      achievements: ctx.achievements.map((a) => ({ id: a.id, type: a.type, title: a.title, issuer: a.issuer })),
      milestones: milestones.map((m) => ({
        id: m.id,
        title: m.title,
        status: m.status,
        progress: m.quests.length ? Math.round(m.quests.reduce((s, q) => s + q.progress, 0) / m.quests.length) : 0,
      })),
      quests: quests.map((q) => ({
        id: q.id,
        milestoneId: q.milestoneId,
        title: q.title,
        progress: q.progress,
        status: q.status,
        skillSlug: q.relatedSkill?.slug ?? null,
        xp: q.xp,
      })),
      opportunities: [],
      events: [],
      courses: [],
      books: [],
      papers: [],
      people: [],
    };
    if (!goal) return base;

    if (withRecommendations) {
      const signal = await this.discover.signal(ctx.user.id, ctx);
      const [jobs, growth, books, papers, people] = await Promise.all([
        this.discover.jobs(ctx.user.id, { limit: 6 }, signal),
        this.discover.growth(ctx.user.id, undefined, signal),
        this.discover.books(ctx.user.id, undefined, signal),
        this.discover.papers(ctx.user.id, undefined, signal),
        this.discover.people(ctx.user.id, undefined, signal),
      ]);
      const appliedIds = new Set(ctx.applications.filter((a) => SUBMITTED.includes(a.status)).map((a) => a.opportunityId));
      const toSlugs = (names: string[]) => names.map((n) => SKILL_SLUG_BY_NAME.get(n) ?? null).filter((s): s is string => s !== null);
      base.opportunities = jobs.slice(0, 5).map((j) => ({
        id: j.opportunity.id,
        title: j.opportunity.title,
        company: j.opportunity.company,
        skills: toSlugs(j.opportunity.skills),
        match: j.match.overall,
        applied: appliedIds.has(j.opportunity.id),
      }));
      for (const a of ctx.applications) {
        if (base.opportunities.some((o) => o.id === a.opportunityId)) continue;
        base.opportunities.push({
          id: a.opportunityId,
          title: a.opportunity.title,
          company: a.opportunity.company,
          skills: a.opportunity.skills,
          match: a.matchScore,
          applied: appliedIds.has(a.opportunityId),
        });
      }
      base.events = growth
        .filter((g) => g.kind === 'EVENT')
        .slice(0, 3)
        .map((e) => ({ id: e.id, title: e.title, type: e.type, skills: toSlugs(e.skills), startsAt: e.startsAt ?? '', relevance: e.relevance }));
      base.courses = growth
        .filter((g) => g.kind === 'RESOURCE')
        .slice(0, 3)
        .map((c) => ({ id: c.id, title: c.title, provider: c.provider, skills: toSlugs(c.skills), relevance: c.relevance }));
      base.books = books.slice(0, 3).map((b) => ({
        id: b.id,
        title: b.title,
        authors: b.authors,
        skills: toSlugs(b.skills),
        relevance: b.relevance,
        completed: b.saved?.status === 'COMPLETED',
      }));
      base.papers = papers.slice(0, 2).map((p) => ({ id: p.id, title: p.title, year: p.year, skills: toSlugs(p.skills), relevance: p.relevance }));
      const roleModels = people.filter((p) => p.kind === 'ROLE_MODEL').slice(0, 2);
      const mentors = people.filter((p) => p.kind === 'MENTOR').slice(0, 1);
      base.people = [...roleModels, ...mentors].map((p) => ({
        id: p.id,
        kind: p.kind,
        name: p.name,
        headline: p.headline,
        relatedRoles: p.relatedRole === goal.role.title ? [goal.role.slug] : [],
        relevance: p.relevance,
      }));
    } else {
      // Keep the previously computed recommendation layer; only career state changed.
      const existing = await this.prisma.graphNode.findMany({ where: { userId: ctx.user.id, type: { in: RECOMMENDATION_TYPES }, source: 'SYSTEM' } });
      for (const n of existing) {
        const m = n.metadataJson as Record<string, any>;
        const skillsMeta: string[] = Array.isArray(m.skills) ? m.skills : [];
        const relevance = Number(m.relevance ?? m.match ?? 50);
        switch (n.type) {
          case 'OPPORTUNITY':
            base.opportunities.push({ id: n.entityId!, title: n.label, company: String(m.company ?? ''), skills: skillsMeta, match: Number(m.match ?? 0), applied: Boolean(m.applied) });
            break;
          case 'EVENT':
            base.events.push({ id: n.entityId!, title: n.label, type: n.description ?? 'EVENT', skills: skillsMeta, startsAt: String(m.startsAt ?? ''), relevance });
            break;
          case 'COURSE':
            base.courses.push({ id: n.entityId!, title: n.label, provider: n.description ?? '', skills: skillsMeta, relevance });
            break;
          case 'BOOK':
            base.books.push({ id: n.entityId!, title: n.label, authors: (n.description ?? '').split(', '), skills: skillsMeta, relevance, completed: Boolean(m.completed) });
            break;
          case 'PAPER':
            base.papers.push({ id: n.entityId!, title: n.label, year: n.description ? Number(n.description) : null, skills: skillsMeta, relevance });
            break;
          case 'ROLE_MODEL':
          case 'MENTOR':
            base.people.push({ id: n.entityId!, kind: n.type, name: n.label, headline: n.description ?? '', relatedRoles: m.relatedRoles ?? [], relevance });
            break;
        }
      }
    }
    return base;
  }

  private async persist(userId: string, built: BuiltGraph): Promise<void> {
    // Remember skills/roles on recommendation nodes so partial rebuilds can reconstruct edges.
    const skillsByKey = new Map<string, string[]>();
    for (const e of built.edges) {
      if (e.targetKey.startsWith('skill:') && /^(opp|event|course|book|paper):/.test(e.sourceKey)) {
        skillsByKey.set(e.sourceKey, [...(skillsByKey.get(e.sourceKey) ?? []), e.targetKey.slice(6)]);
      }
    }
    const rolesByKey = new Map<string, string[]>();
    for (const e of built.edges) {
      if (e.sourceKey.startsWith('person:') && e.targetKey.startsWith('role:')) {
        rolesByKey.set(e.sourceKey, [...(rolesByKey.get(e.sourceKey) ?? []), e.targetKey.slice(5)]);
      }
    }

    const existing = await this.prisma.graphNode.findMany({ where: { userId } });
    const byKey = new Map(existing.map((n) => [n.key, n]));
    const builtKeys = new Set(built.nodes.map((n) => n.key));

    const toCreate: Prisma.GraphNodeCreateManyInput[] = [];
    const updates: Promise<unknown>[] = [];
    for (const n of built.nodes) {
      const metadata = {
        ...n.metadata,
        ...(skillsByKey.has(n.key) ? { skills: skillsByKey.get(n.key) } : {}),
        ...(rolesByKey.has(n.key) ? { relatedRoles: rolesByKey.get(n.key) } : {}),
      };
      const prev = byKey.get(n.key);
      if (!prev) {
        toCreate.push({ userId, key: n.key, type: n.type, label: n.label, description: n.description, metadataJson: metadata as Prisma.InputJsonValue, entityId: n.entityId, confidence: n.confidence, source: 'SYSTEM' });
      } else if (
        prev.source === 'SYSTEM' &&
        (prev.type !== n.type || prev.label !== n.label || prev.description !== n.description || JSON.stringify(prev.metadataJson) !== JSON.stringify(metadata) || prev.confidence !== n.confidence)
      ) {
        updates.push(
          this.prisma.graphNode.update({
            where: { id: prev.id },
            data: { type: n.type, label: n.label, description: n.description, metadataJson: metadata as Prisma.InputJsonValue, entityId: n.entityId, confidence: n.confidence },
          }),
        );
      }
    }
    const stale = existing.filter((n) => n.source === 'SYSTEM' && !builtKeys.has(n.key)).map((n) => n.id);

    await this.prisma.$transaction(async (tx) => {
      if (stale.length) await tx.graphNode.deleteMany({ where: { id: { in: stale } } });
      if (toCreate.length) await tx.graphNode.createMany({ data: toCreate, skipDuplicates: true });
    });
    await Promise.all(updates);

    const nodes = await this.prisma.graphNode.findMany({ where: { userId }, select: { id: true, key: true } });
    const idByKey = new Map(nodes.map((n) => [n.key, n.id]));
    await this.prisma.$transaction([
      this.prisma.graphEdge.deleteMany({ where: { userId, source: 'SYSTEM' } }),
      this.prisma.graphEdge.createMany({
        data: built.edges
          .filter((e) => idByKey.has(e.sourceKey) && idByKey.has(e.targetKey))
          .map((e) => ({
            userId,
            sourceNodeId: idByKey.get(e.sourceKey)!,
            targetNodeId: idByKey.get(e.targetKey)!,
            relationship: e.relationship,
            weight: e.weight,
            source: 'SYSTEM' as const,
          })),
        skipDuplicates: true,
      }),
    ]);
  }

  // -------------------------------------------------------------------------
  // Read
  // -------------------------------------------------------------------------

  async graph(userId: string): Promise<UniverseGraph> {
    const [nodes, edges] = await Promise.all([
      this.prisma.graphNode.findMany({ where: { userId } }),
      this.prisma.graphEdge.findMany({ where: { userId } }),
    ]);
    const updatedAt = nodes.reduce<Date | null>((max, n) => (!max || n.updatedAt > max ? n.updatedAt : max), null);
    return {
      nodes: nodes.map(toNodeView),
      edges: edges.map((e) => ({ id: e.id, source: e.sourceNodeId, target: e.targetNodeId, relationship: e.relationship, weight: e.weight })),
      updatedAt: updatedAt?.toISOString() ?? null,
    };
  }

  async nodeDetail(userId: string, nodeId: string): Promise<NodeDetail> {
    const node = await this.prisma.graphNode.findFirst({
      where: { id: nodeId, userId },
      include: { outEdges: { include: { targetNode: true } }, inEdges: { include: { sourceNode: true } } },
    });
    if (!node) throw notFound('Node');
    const connections = [
      ...node.outEdges.map((e) => ({ node: toNodeView(e.targetNode), relationship: e.relationship, direction: 'out' as const })),
      ...node.inEdges.map((e) => ({ node: toNodeView(e.sourceNode), relationship: e.relationship, direction: 'in' as const })),
    ];
    const detail: NodeDetail = { node: toNodeView(node), connections, recommendedAction: null, link: linkFor(node) };

    if (node.type === 'SKILL' || node.type === 'GAP') {
      const meta = node.metadataJson as Record<string, any>;
      const slug: string = meta.slug;
      const ctx = await this.context.load(userId);
      const goal = ctx.primaryGoal;
      const req = goal?.role.requirements.find((r) => r.skill.slug === slug);
      const level = ctx.skillLevelsBySlug.get(slug) ?? 0;
      const now = new Date();
      const [requiredByJobs, courses, books, papers, events] = await Promise.all([
        this.prisma.opportunity.count({
          where: { isActive: true, skills: { has: slug }, ...(ctx.goals.length ? { roleSlugs: { hasSome: ctx.goals.map((g) => g.role.slug) } } : {}) },
        }),
        this.prisma.resource.count({ where: { skills: { has: slug } } }),
        this.prisma.book.count({ where: { skills: { has: slug } } }),
        this.prisma.researchPaper.count({ where: { skills: { has: slug } } }),
        this.prisma.event.count({ where: { skills: { has: slug }, startsAt: { gte: now } } }),
      ]);
      const inJourney = ctx.journeySkillSlugs.has(slug);
      const isGap = Boolean(req && level < req.requiredLevel);
      detail.skill = {
        skillId: meta.skillId,
        currentLevel: level,
        currentLabel: skillLevelLabel(level),
        requiredLevel: req?.requiredLevel ?? null,
        requiredLabel: req ? skillLevelLabel(req.requiredLevel) : null,
        relatedCareer: goal?.role.title ?? null,
        requiredByJobs,
        resources: { courses, books, papers, events },
        inJourney,
        isGap,
      };
      detail.recommendedAction = await this.skillAction(ctx, slug, node.label, isGap, inJourney, req?.requiredLevel ?? null, requiredByJobs);
    }
    return detail;
  }

  /** Recommendation for a skill node, with a deterministic estimate of readiness impact. */
  async skillAction(
    ctx: CareerContext,
    slug: string,
    name: string,
    isGap: boolean,
    inJourney: boolean,
    requiredLevel: number | null,
    requiredByJobs: number,
  ): Promise<NextBestAction | null> {
    if (inJourney) {
      const quest = ctx.quests.find((q) => q.relatedSkill?.slug === slug && q.status !== 'COMPLETED');
      return quest
        ? {
            title: `Continue “${quest.title}”`,
            reason: `${name} is already part of your journey (${quest.progress}% complete).`,
            expectedImpact: 'Each completed task raises this skill and your readiness.',
            kind: 'QUEST_TASK',
            actionLabel: 'Open Quest',
            actionUrl: `/app/journey?quest=${quest.id}`,
          }
        : null;
    }
    if (!isGap || !ctx.primaryGoal || requiredLevel === null) return null;
    const simulated = new Map(ctx.skillLevels);
    const skill = [...ctx.skillById.values()].find((s) => s.slug === slug);
    if (skill) simulated.set(skill.id, requiredLevel);
    const now = this.readiness.computeFor(ctx, ctx.primaryGoal).score;
    const after = this.readiness.computeFor({ ...ctx, skillLevels: simulated }, ctx.primaryGoal).score;
    const delta = Math.max(0, Math.round((after - now) * 10) / 10);
    const tpl = questTemplateForSkill(slug);
    return {
      title: tpl.title,
      reason: requiredByJobs > 0 ? `Required by ${requiredByJobs} matching job${requiredByJobs === 1 ? '' : 's'} aligned with your target role.` : `A core requirement for ${ctx.primaryGoal.role.title}.`,
      expectedImpact: `Career Readiness +${delta} estimated points.`,
      kind: 'ADD_SKILL',
      actionLabel: 'Add to Journey',
      actionUrl: '/app/journey',
      action: { type: 'ADD_SKILL_TO_JOURNEY', payload: { skillSlug: slug } },
    };
  }

  // -------------------------------------------------------------------------
  // User / agent authored nodes
  // -------------------------------------------------------------------------

  async addNode(
    userId: string,
    input: { type: NodeType; label: string; description?: string; connectToNodeId?: string; relationship?: EdgeRelationship },
    source: 'USER' | 'AGENT' = 'USER',
  ): Promise<GraphNodeView> {
    if (input.type === 'USER') throw badRequest('The user node is managed by Orbit.');
    const node = await this.prisma.graphNode.create({
      data: { userId, key: `${source.toLowerCase()}:${randomUUID()}`, type: input.type, label: input.label, description: input.description, source, confidence: source === 'AGENT' ? 0.8 : 1 },
    });
    const target = input.connectToNodeId
      ? await this.prisma.graphNode.findFirst({ where: { id: input.connectToNodeId, userId } })
      : await this.prisma.graphNode.findFirst({ where: { userId, key: 'user' } });
    if (target) {
      await this.prisma.graphEdge.create({
        data: { userId, sourceNodeId: target.id, targetNodeId: node.id, relationship: input.relationship ?? 'RELATED_TO', source },
      });
    }
    return toNodeView(node);
  }

  async addEdge(userId: string, input: { sourceNodeId: string; targetNodeId: string; relationship: EdgeRelationship }) {
    const count = await this.prisma.graphNode.count({ where: { userId, id: { in: [input.sourceNodeId, input.targetNodeId] } } });
    if (count !== 2) throw notFound('Node');
    const edge = await this.prisma.graphEdge.upsert({
      where: { sourceNodeId_targetNodeId_relationship: input },
      update: {},
      create: { userId, ...input, source: 'USER' },
    });
    return { id: edge.id, source: edge.sourceNodeId, target: edge.targetNodeId, relationship: edge.relationship, weight: edge.weight };
  }

  async removeNode(userId: string, nodeId: string) {
    const node = await this.prisma.graphNode.findFirst({ where: { id: nodeId, userId } });
    if (!node) throw notFound('Node');
    if (node.source === 'SYSTEM') throw badRequest('Nodes derived from your profile update automatically and cannot be deleted here.');
    await this.prisma.graphNode.delete({ where: { id: nodeId } });
    return { removed: true };
  }
}

export function toNodeView(n: GraphNode): GraphNodeView {
  return {
    id: n.id,
    key: n.key,
    type: n.type,
    label: n.label,
    description: n.description,
    metadata: (n.metadataJson as Record<string, unknown>) ?? {},
    source: n.source,
    confidence: n.confidence,
  };
}

function linkFor(n: GraphNode): NodeDetail['link'] {
  const id = n.entityId;
  switch (n.type) {
    case 'OPPORTUNITY':
      return { label: 'View opportunity', url: `/app/discover/jobs/${id}` };
    case 'QUEST':
      return { label: 'Open quest', url: `/app/journey?quest=${id}` };
    case 'GOAL':
      return { label: 'Open journey', url: `/app/journey?milestone=${id}` };
    case 'BOOK':
    case 'PAPER':
      return { label: 'Open in Discover', url: `/app/discover?tab=knowledge&focus=${id}` };
    case 'EVENT':
    case 'COURSE':
      return { label: 'Open in Discover', url: `/app/discover?tab=growth&focus=${id}` };
    case 'ROLE_MODEL':
    case 'MENTOR':
      return { label: 'Compare with you', url: `/app/discover?tab=people&focus=${id}` };
    case 'EXPERIENCE':
    case 'PROJECT':
    case 'COMPETITION':
    case 'CERTIFICATION':
      return { label: 'View in profile', url: '/app/profile' };
    case 'CAREER_ROLE':
      return { label: 'Career Intelligence', url: '/app/profile' };
    default:
      return null;
  }
}
