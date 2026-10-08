import { buildCareerGraph, skillKey, type BuilderInput } from './graph.builder';

function input(overrides: Partial<BuilderInput> = {}): BuilderInput {
  return {
    user: { id: 'u1', name: 'Stanley Wijaya', headline: 'CS student' },
    primaryRole: { slug: 'product-manager', title: 'Product Manager', description: 'Builds products' },
    otherRoles: [],
    skills: [
      { skillId: 's1', slug: 'leadership', name: 'Leadership', category: 'Soft', level: 75, requiredLevel: 60, importance: 4 },
      { skillId: 's2', slug: 'product-analytics', name: 'Product Analytics', category: 'Product', level: 10, requiredLevel: 65, importance: 5 },
      { skillId: 's3', slug: 'python', name: 'Python', category: 'Tech', level: 55, requiredLevel: null, importance: null },
      { skillId: 's4', slug: 'cobol', name: 'COBOL', category: 'Tech', level: 5, requiredLevel: null, importance: null },
    ],
    experiences: [{ id: 'e1', type: 'LEADERSHIP', title: 'Head of Tech Division', organization: 'HIMTI', skills: ['Leadership'] }],
    achievements: [],
    milestones: [],
    quests: [],
    opportunities: [{ id: 'o1', title: 'PM Intern', company: 'Nusantara Pay', skills: ['product-analytics'], match: 88, applied: false }],
    events: [],
    courses: [],
    books: [],
    papers: [],
    people: [],
    ...overrides,
  };
}

const edge = (g: ReturnType<typeof buildCareerGraph>, s: string, t: string) => g.edges.find((e) => e.sourceKey === s && e.targetKey === t);

describe('Career graph builder', () => {
  it('centres the graph on the user and links the target role', () => {
    const g = buildCareerGraph(input());
    expect(g.nodes.find((n) => n.key === 'user')).toMatchObject({ type: 'USER', label: 'Stanley Wijaya' });
    expect(edge(g, 'user', 'role:product-manager')?.relationship).toBe('TARGETS');
  });

  it('classifies skills below the required level as GAP nodes and the rest as SKILL', () => {
    const g = buildCareerGraph(input());
    const type = (slug: string) => g.nodes.find((n) => n.key === skillKey(slug))?.type;
    expect(type('product-analytics')).toBe('GAP');
    expect(type('leadership')).toBe('SKILL');
    expect(type('python')).toBe('SKILL');
    expect(type('cobol')).toBeUndefined(); // too weak to show as an owned skill
    expect(edge(g, 'role:product-manager', skillKey('product-analytics'))?.relationship).toBe('REQUIRES');
  });

  it('turns a closed gap into a skill when the level improves (graph update)', () => {
    const before = buildCareerGraph(input());
    const improved = input();
    improved.skills = improved.skills.map((s) => (s.slug === 'product-analytics' ? { ...s, level: 70 } : s));
    const after = buildCareerGraph(improved);
    expect(before.nodes.find((n) => n.key === skillKey('product-analytics'))?.type).toBe('GAP');
    expect(after.nodes.find((n) => n.key === skillKey('product-analytics'))?.type).toBe('SKILL');
    expect(edge(after, 'user', skillKey('product-analytics'))?.relationship).toBe('HAS_SKILL');
  });

  it('connects experiences to the skills they mention and opportunities to their required skills', () => {
    const g = buildCareerGraph(input());
    expect(edge(g, 'exp:e1', skillKey('leadership'))?.relationship).toBe('RELATED_TO');
    expect(edge(g, 'opp:o1', skillKey('product-analytics'))?.relationship).toBe('REQUIRES');
    expect(edge(g, 'opp:o1', 'user')?.weight).toBe(0.88);
  });

  it('links quests to their milestone and the skill they improve', () => {
    const g = buildCareerGraph(
      input({
        milestones: [{ id: 'm1', title: 'Product Analytics', progress: 25, status: 'IN_PROGRESS' }],
        quests: [{ id: 'q1', milestoneId: 'm1', title: 'Analytics Foundations', progress: 25, status: 'IN_PROGRESS', skillSlug: 'product-analytics', xp: 150 }],
      }),
    );
    expect(edge(g, 'quest:q1', 'milestone:m1')?.relationship).toBe('PART_OF');
    expect(edge(g, 'quest:q1', skillKey('product-analytics'))?.relationship).toBe('IMPROVES');
  });

  it('never produces duplicate nodes, self-loops or dangling edges', () => {
    const g = buildCareerGraph(input({ otherRoles: [{ slug: 'product-manager', title: 'dup', requirementSlugs: ['ghost-skill'] }] }));
    const keys = g.nodes.map((n) => n.key);
    expect(new Set(keys).size).toBe(keys.length);
    const known = new Set(keys);
    for (const e of g.edges) {
      expect(e.sourceKey).not.toBe(e.targetKey);
      expect(known.has(e.sourceKey) && known.has(e.targetKey)).toBe(true);
    }
  });
});
