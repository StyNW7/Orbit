import { JOB_MATCH_WEIGHTS } from '@orbit/shared';
import { computeJobMatch, preferenceMatch, skillMatch, type MatchJob, type MatchUser } from './job-match.engine';

const pmIntern: MatchJob = {
  title: 'Product Management Intern',
  description: 'Work with product managers on discovery and analytics.',
  skills: ['product-analytics', 'sql', 'leadership'],
  roleSlugs: ['product-manager'],
  workMode: 'HYBRID',
  employmentType: 'INTERNSHIP',
  location: 'Jakarta, Indonesia',
  seniority: 'ENTRY',
  industry: 'Fintech',
};

function user(overrides: Partial<MatchUser> = {}): MatchUser {
  return {
    skillLevels: new Map([
      ['leadership', 75],
      ['sql', 20],
    ]),
    skillNames: new Map([
      ['leadership', 'Leadership'],
      ['sql', 'SQL'],
      ['product-analytics', 'Product Analytics'],
    ]),
    primaryRole: { slug: 'product-manager', title: 'Product Manager', keywords: ['product'] },
    otherRoleSlugs: [],
    experiences: [
      { type: 'LEADERSHIP', months: 12 },
      { type: 'PROJECT', months: 4 },
    ],
    isStudent: true,
    technicalBackground: true,
    preferences: { workModes: ['HYBRID'], roleTypes: ['INTERNSHIP'], locations: ['Jakarta'], industries: ['Fintech'] },
    journeySkillSlugs: new Set(),
    ...overrides,
  };
}

describe('Job Match Engine', () => {
  it('uses the documented 25/25/20/15/15 weights', () => {
    expect(Object.values(JOB_MATCH_WEIGHTS).reduce((s, v) => s + v, 0)).toBeCloseTo(1);
    expect(JOB_MATCH_WEIGHTS).toEqual({ roleAlignment: 0.25, skillMatch: 0.25, experienceMatch: 0.2, preferenceMatch: 0.15, careerGoalMatch: 0.15 });
  });

  it('computes the overall score as the weighted sum of its components', () => {
    const m = computeJobMatch(pmIntern, user());
    const expected = (Object.keys(JOB_MATCH_WEIGHTS) as (keyof typeof JOB_MATCH_WEIGHTS)[]).reduce((s, k) => s + (m.components[k] / 100) * JOB_MATCH_WEIGHTS[k], 0);
    expect(Math.abs(m.overall - expected * 100)).toBeLessThanOrEqual(2); // components are rounded individually
    expect(m.overall).toBeGreaterThan(0);
    expect(m.overall).toBeLessThanOrEqual(100);
  });

  it('explains why the user matches and what is missing', () => {
    const m = computeJobMatch(pmIntern, user());
    expect(m.reasons).toEqual(expect.arrayContaining(['Leadership', 'Technical Background', 'Project Experience']));
    expect(m.matchedSkills).toEqual(['Leadership']);
    expect(m.missingSkills.map((s) => s.name)).toEqual(['Product Analytics', 'SQL']);
    expect(m.recommendedAction).toBe('Add Product Analytics to Journey');
  });

  it('switches the recommendation once the gap is already in the journey', () => {
    const m = computeJobMatch(pmIntern, user({ journeySkillSlugs: new Set(['product-analytics']) }));
    expect(m.missingSkills[0]).toMatchObject({ slug: 'product-analytics', inJourney: true });
    expect(m.recommendedAction).toBe('Keep progressing Product Analytics in your Journey');
  });

  it('ranks a target-role job above an unrelated one', () => {
    const unrelated: MatchJob = { ...pmIntern, title: 'Warehouse Supervisor', description: 'Logistics shifts', roleSlugs: ['operations'], skills: ['forklift'] };
    expect(computeJobMatch(pmIntern, user()).overall).toBeGreaterThan(computeJobMatch(unrelated, user()).overall);
  });

  it('improves skill match as the user levels up a missing skill', () => {
    const before = skillMatch(pmIntern, user()).score;
    const after = skillMatch(pmIntern, user({ skillLevels: new Map([['leadership', 75], ['sql', 60], ['product-analytics', 60]]) })).score;
    expect(after).toBeGreaterThan(before);
    expect(after).toBe(1);
  });

  it('rewards matching preferences and treats remote jobs as location-agnostic', () => {
    expect(preferenceMatch(pmIntern, user())).toBe(1);
    const remoteElsewhere: MatchJob = { ...pmIntern, workMode: 'REMOTE', location: 'Singapore' };
    const prefs = user({ preferences: { workModes: ['REMOTE'], roleTypes: ['INTERNSHIP'], locations: ['Jakarta'], industries: [] } });
    expect(preferenceMatch(remoteElsewhere, prefs)).toBe(1);
  });
});
