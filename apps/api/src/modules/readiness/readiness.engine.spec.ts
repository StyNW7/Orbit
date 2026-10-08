import { DEFAULT_READINESS_WEIGHTS, READINESS_CATEGORIES } from '@orbit/shared';
import { computeReadiness, normalizeWeights, scoreSkills, type ReadinessInput } from './readiness.engine';

const NOW = new Date('2026-10-08T00:00:00Z');

function baseInput(overrides: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    role: {
      slug: 'product-manager',
      title: 'Product Manager',
      requirements: [
        { skillId: 'analytics', skillName: 'Product Analytics', requiredLevel: 60, importance: 3 },
        { skillId: 'discovery', skillName: 'Product Discovery', requiredLevel: 60, importance: 2 },
      ],
      experienceSignals: [
        { id: 'lead', label: 'Leadership', types: ['LEADERSHIP', 'ORGANIZATION'], keywords: [], weight: 0.5 },
        { id: 'product', label: 'Product experience', types: ['INTERNSHIP', 'WORK'], keywords: ['product'], weight: 0.5 },
      ],
    },
    skillLevels: new Map(),
    experiences: [],
    achievements: [],
    quests: [],
    evidence: [],
    knowledgeCompleted: 0,
    educationCount: 0,
    profile: { hasCv: false, hasHeadline: false, linkedinUrl: null, portfolioUrl: null, githubUrl: null, skillCount: 0 },
    applications: [],
    interviews: [],
    now: NOW,
    ...overrides,
  };
}

describe('Career Readiness Engine', () => {
  describe('normalizeWeights', () => {
    it('uses the documented default weights (30/25/15/10/10/10)', () => {
      const w = normalizeWeights();
      expect(w).toEqual(DEFAULT_READINESS_WEIGHTS);
      expect(READINESS_CATEGORIES.reduce((s, c) => s + w[c], 0)).toBeCloseTo(1);
    });

    it('renormalises partial overrides so weights still sum to 1', () => {
      const w = normalizeWeights({ SKILL: 0.6 });
      expect(READINESS_CATEGORIES.reduce((s, c) => s + w[c], 0)).toBeCloseTo(1);
      expect(w.SKILL).toBeGreaterThan(DEFAULT_READINESS_WEIGHTS.SKILL);
    });

    it('falls back to defaults when every weight is zero or negative', () => {
      const zero = Object.fromEntries(READINESS_CATEGORIES.map((c) => [c, 0]));
      expect(normalizeWeights(zero)).toEqual(DEFAULT_READINESS_WEIGHTS);
    });
  });

  it('scores an empty profile at zero', () => {
    expect(computeReadiness(baseInput()).score).toBe(0);
  });

  it('is deterministic: the same input always yields the same score', () => {
    const input = baseInput({ skillLevels: new Map([['analytics', 30]]) });
    expect(computeReadiness(input).score).toBe(computeReadiness(input).score);
  });

  it('weights skill requirements by importance and caps each skill at its required level', () => {
    const half = scoreSkills(baseInput({ skillLevels: new Map([['analytics', 60]]) }));
    const over = scoreSkills(baseInput({ skillLevels: new Map([['analytics', 100]]) }));
    expect(half.ratio).toBeCloseTo(3 / 5); // only the importance-3 skill is met
    expect(over.ratio).toBeCloseTo(half.ratio); // exceeding the requirement earns nothing extra
    expect(half.details[0]).toBe('1 of 2 required skills at target level');
  });

  it('raises the score when a gap skill improves (quest progress feeds readiness)', () => {
    const before = computeReadiness(baseInput({ skillLevels: new Map([['analytics', 10]]) })).score;
    const after = computeReadiness(baseInput({ skillLevels: new Map([['analytics', 40]]) })).score;
    expect(after).toBeGreaterThan(before);
  });

  it('gives partial experience credit when the type matches but keywords do not', () => {
    const experience = {
      type: 'INTERNSHIP' as const,
      title: 'Backend Intern',
      organization: 'Acme',
      description: 'APIs',
      skills: [],
      startDate: null,
      endDate: null,
      current: false,
    };
    const partial = computeReadiness(baseInput({ experiences: [experience] }));
    const full = computeReadiness(baseInput({ experiences: [{ ...experience, title: 'Product Intern' }] }));
    const exp = (r: typeof partial) => r.breakdown.find((b) => b.category === 'EXPERIENCE')!.score;
    expect(exp(partial)).toBe(20); // 0.5 weight * 0.4 partial credit
    expect(exp(full)).toBe(50);
  });

  it('reports a breakdown whose contributions add up to the total', () => {
    const r = computeReadiness(
      baseInput({
        skillLevels: new Map([
          ['analytics', 45],
          ['discovery', 70],
        ]),
        profile: { hasCv: true, hasHeadline: true, linkedinUrl: 'x', portfolioUrl: null, githubUrl: 'y', skillCount: 8 },
        knowledgeCompleted: 3,
        educationCount: 1,
      }),
    );
    expect(r.breakdown).toHaveLength(READINESS_CATEGORIES.length);
    const sum = r.breakdown.reduce((s, b) => s + b.contribution, 0);
    expect(sum).toBeCloseTo(r.score, 0);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it('respects custom weights', () => {
    const input = baseInput({ skillLevels: new Map([['analytics', 60], ['discovery', 60]]) });
    const skillHeavy = computeReadiness({ ...input, weights: { SKILL: 1, EXPERIENCE: 0, PORTFOLIO: 0, KNOWLEDGE: 0, APPLICATION: 0, INTERVIEW: 0 } });
    expect(skillHeavy.score).toBe(100);
  });
});
