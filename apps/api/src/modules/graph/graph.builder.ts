/**
 * Career Universe builder — derives the system-owned part of a user's career
 * graph from their long-term memory (profile, skills, goals, journey) and
 * the current top recommendations. Pure: no I/O.
 *
 * Node identity is a stable `key` so the graph can be re-synced idempotently.
 * A skill keeps the same key whether it is a GAP or a SKILL, so closing a gap
 * visibly transforms the node in the Universe.
 */
import type { EdgeRelationship, ExperienceType, NodeType } from '@orbit/shared';
import { normalizeTerm } from '@orbit/shared';

export interface BuilderSkill {
  skillId: string;
  slug: string;
  name: string;
  category: string;
  level: number; // effective
  requiredLevel: number | null;
  importance: number | null;
}

export interface BuilderInput {
  user: { id: string; name: string; headline: string | null };
  primaryRole: { slug: string; title: string; description: string } | null;
  otherRoles: { slug: string; title: string; requirementSlugs: string[] }[];
  skills: BuilderSkill[];
  experiences: { id: string; type: ExperienceType; title: string; organization: string; skills: string[] }[];
  achievements: { id: string; type: 'AWARD' | 'CERTIFICATION' | 'PUBLICATION'; title: string; issuer: string | null }[];
  milestones: { id: string; title: string; progress: number; status: string }[];
  quests: { id: string; milestoneId: string; title: string; progress: number; status: string; skillSlug: string | null; xp: number }[];
  opportunities: { id: string; title: string; company: string; skills: string[]; match: number; applied: boolean }[];
  events: { id: string; title: string; type: string; skills: string[]; startsAt: string; relevance: number }[];
  courses: { id: string; title: string; provider: string; skills: string[]; relevance: number }[];
  books: { id: string; title: string; authors: string[]; skills: string[]; relevance: number; completed: boolean }[];
  papers: { id: string; title: string; year: number | null; skills: string[]; relevance: number }[];
  people: { id: string; kind: 'ROLE_MODEL' | 'MENTOR'; name: string; headline: string; relatedRoles: string[]; relevance: number }[];
}

export interface BuiltNode {
  key: string;
  type: NodeType;
  label: string;
  description: string | null;
  metadata: Record<string, unknown>;
  entityId: string | null;
  confidence: number;
}

export interface BuiltEdge {
  sourceKey: string;
  targetKey: string;
  relationship: EdgeRelationship;
  weight: number;
}

export interface BuiltGraph {
  nodes: BuiltNode[];
  edges: BuiltEdge[];
}

const MIN_OWNED_LEVEL = 20;
const MAX_OWNED_SKILLS = 18;

export const skillKey = (slug: string) => `skill:${slug}`;

function experienceNodeType(type: ExperienceType): NodeType {
  if (type === 'PROJECT') return 'PROJECT';
  if (type === 'COMPETITION') return 'COMPETITION';
  return 'EXPERIENCE';
}

export function buildCareerGraph(input: BuilderInput): BuiltGraph {
  const nodes = new Map<string, BuiltNode>();
  const edges = new Map<string, BuiltEdge>();

  const addNode = (n: BuiltNode) => {
    if (!nodes.has(n.key)) nodes.set(n.key, n);
  };
  const addEdge = (sourceKey: string, targetKey: string, relationship: EdgeRelationship, weight = 1) => {
    if (sourceKey === targetKey || !nodes.has(sourceKey) || !nodes.has(targetKey)) return;
    const id = `${sourceKey}|${targetKey}|${relationship}`;
    if (!edges.has(id)) edges.set(id, { sourceKey, targetKey, relationship, weight: Math.round(weight * 100) / 100 });
  };

  // --- Centre: the user -------------------------------------------------
  addNode({
    key: 'user',
    type: 'USER',
    label: input.user.name,
    description: input.user.headline,
    metadata: { size: 'xl' },
    entityId: input.user.id,
    confidence: 1,
  });

  // --- Career roles -----------------------------------------------------
  const roleKey = input.primaryRole ? `role:${input.primaryRole.slug}` : null;
  if (input.primaryRole && roleKey) {
    addNode({
      key: roleKey,
      type: 'CAREER_ROLE',
      label: input.primaryRole.title,
      description: input.primaryRole.description,
      metadata: { primary: true, slug: input.primaryRole.slug, size: 'lg' },
      entityId: input.primaryRole.slug,
      confidence: 1,
    });
    addEdge('user', roleKey, 'TARGETS', 1);
  }
  for (const role of input.otherRoles) {
    addNode({
      key: `role:${role.slug}`,
      type: 'CAREER_ROLE',
      label: role.title,
      description: 'Alternative orbit you are exploring',
      metadata: { primary: false, slug: role.slug },
      entityId: role.slug,
      confidence: 0.8,
    });
    addEdge('user', `role:${role.slug}`, 'TARGETS', 0.5);
  }

  // --- Skills & gaps ------------------------------------------------------
  const required = input.skills.filter((s) => s.requiredLevel !== null);
  const owned = input.skills
    .filter((s) => s.requiredLevel === null && s.level >= MIN_OWNED_LEVEL)
    .sort((a, b) => b.level - a.level)
    .slice(0, MAX_OWNED_SKILLS);
  const skillNameIndex = new Map<string, string>(); // normalized name/slug -> key

  for (const s of [...required, ...owned]) {
    const isGap = s.requiredLevel !== null && s.level < s.requiredLevel;
    const key = skillKey(s.slug);
    addNode({
      key,
      type: isGap ? 'GAP' : 'SKILL',
      label: s.name,
      description: isGap
        ? `Current ${s.level} of required ${s.requiredLevel}`
        : s.requiredLevel !== null
          ? 'Meets the requirement of your target role'
          : 'Skill from your profile',
      metadata: {
        skillId: s.skillId,
        slug: s.slug,
        category: s.category,
        level: s.level,
        requiredLevel: s.requiredLevel,
        importance: s.importance,
        gap: isGap,
      },
      entityId: s.skillId,
      confidence: 1,
    });
    skillNameIndex.set(normalizeTerm(s.name), key);
    skillNameIndex.set(s.slug, key);
    if (s.level >= MIN_OWNED_LEVEL) addEdge('user', key, 'HAS_SKILL', s.level / 100);
    if (roleKey && s.requiredLevel !== null) addEdge(roleKey, key, 'REQUIRES', (s.importance ?? 3) / 5);
  }
  for (const role of input.otherRoles) {
    for (const slug of role.requirementSlugs) addEdge(`role:${role.slug}`, skillKey(slug), 'REQUIRES', 0.5);
  }
  const resolveSkill = (term: string) => skillNameIndex.get(term) ?? skillNameIndex.get(normalizeTerm(term));

  // --- Experiences & achievements --------------------------------------
  for (const e of input.experiences) {
    const key = `exp:${e.id}`;
    addNode({
      key,
      type: experienceNodeType(e.type),
      label: e.title,
      description: e.organization,
      metadata: { experienceType: e.type, organization: e.organization },
      entityId: e.id,
      confidence: 1,
    });
    addEdge('user', key, 'HAS_EXPERIENCE', 0.8);
    for (const term of e.skills) {
      const sk = resolveSkill(term);
      if (sk) addEdge(key, sk, 'RELATED_TO', 0.6);
    }
  }
  for (const a of input.achievements) {
    const key = `ach:${a.id}`;
    addNode({
      key,
      type: a.type === 'CERTIFICATION' ? 'CERTIFICATION' : 'COMPETITION',
      label: a.title,
      description: a.issuer,
      metadata: { achievementType: a.type },
      entityId: a.id,
      confidence: 1,
    });
    addEdge('user', key, a.type === 'CERTIFICATION' ? 'LEARNED_FROM' : 'HAS_EXPERIENCE', 0.7);
  }

  // --- Journey: milestones (GOAL) and quests ---------------------------
  for (const m of input.milestones) {
    const key = `milestone:${m.id}`;
    addNode({
      key,
      type: 'GOAL',
      label: m.title,
      description: `Journey milestone · ${m.progress}% complete`,
      metadata: { progress: m.progress, status: m.status },
      entityId: m.id,
      confidence: 1,
    });
    if (roleKey) addEdge(key, roleKey, 'SUPPORTS', 0.9);
  }
  for (const q of input.quests) {
    const key = `quest:${q.id}`;
    addNode({
      key,
      type: 'QUEST',
      label: q.title,
      description: `${q.progress}% complete · ${q.xp} XP`,
      metadata: { progress: q.progress, status: q.status, xp: q.xp },
      entityId: q.id,
      confidence: 1,
    });
    addEdge(key, `milestone:${q.milestoneId}`, 'PART_OF', 0.9);
    if (q.skillSlug) addEdge(key, skillKey(q.skillSlug), 'IMPROVES', 0.8);
  }

  // --- Opportunities ----------------------------------------------------
  for (const o of input.opportunities) {
    const key = `opp:${o.id}`;
    addNode({
      key,
      type: 'OPPORTUNITY',
      label: o.title,
      description: `${o.company} · ${o.match}% match`,
      metadata: { company: o.company, match: o.match, applied: o.applied },
      entityId: o.id,
      confidence: o.match / 100,
    });
    addEdge(key, 'user', 'RECOMMENDED_FOR', o.match / 100);
    if (o.applied) addEdge('user', key, 'APPLIED_TO', 1);
    for (const s of o.skills) addEdge(key, skillKey(s), 'REQUIRES', 0.5);
  }

  // --- Growth & knowledge ----------------------------------------------
  const linkResource = (key: string, skills: string[], relationship: EdgeRelationship) => {
    let linked = false;
    for (const s of skills) {
      const sk = skillKey(s);
      if (nodes.has(sk)) {
        addEdge(key, sk, relationship, 0.7);
        linked = true;
      }
    }
    if (!linked && roleKey) addEdge(key, roleKey, 'SUPPORTS', 0.4);
  };
  for (const ev of input.events) {
    const key = `event:${ev.id}`;
    addNode({ key, type: 'EVENT', label: ev.title, description: ev.type, metadata: { startsAt: ev.startsAt, relevance: ev.relevance }, entityId: ev.id, confidence: ev.relevance / 100 });
    linkResource(key, ev.skills, 'IMPROVES');
  }
  for (const c of input.courses) {
    const key = `course:${c.id}`;
    addNode({ key, type: 'COURSE', label: c.title, description: c.provider, metadata: { relevance: c.relevance }, entityId: c.id, confidence: c.relevance / 100 });
    linkResource(key, c.skills, 'IMPROVES');
  }
  for (const b of input.books) {
    const key = `book:${b.id}`;
    addNode({ key, type: 'BOOK', label: b.title, description: b.authors.join(', '), metadata: { relevance: b.relevance, completed: b.completed }, entityId: b.id, confidence: b.relevance / 100 });
    linkResource(key, b.skills, 'IMPROVES');
    if (b.completed) addEdge('user', key, 'LEARNED_FROM', 0.8);
  }
  for (const p of input.papers) {
    const key = `paper:${p.id}`;
    addNode({ key, type: 'PAPER', label: p.title, description: p.year ? String(p.year) : null, metadata: { relevance: p.relevance }, entityId: p.id, confidence: p.relevance / 100 });
    linkResource(key, p.skills, 'RELATED_TO');
  }

  // --- People ------------------------------------------------------------
  for (const person of input.people) {
    const key = `person:${person.id}`;
    addNode({
      key,
      type: person.kind,
      label: person.name,
      description: person.headline,
      metadata: { relevance: person.relevance },
      entityId: person.id,
      confidence: person.relevance / 100,
    });
    addEdge('user', key, 'INSPIRED_BY', person.relevance / 100);
    for (const r of person.relatedRoles) addEdge(key, `role:${r}`, 'RELATED_TO', 0.6);
  }

  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}
