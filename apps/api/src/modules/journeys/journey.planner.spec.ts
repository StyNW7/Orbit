import { ROLE_BY_SLUG } from '../../catalog/roles.catalog';
import { milestoneProgress, planJourney, planSkillAddition, questProgressFromTasks } from './journey.planner';

const pm = ROLE_BY_SLUG.get('product-manager')!;

describe('Career Journey planner', () => {
  it('creates milestones from the role template in order, each with quests', () => {
    const plan = planJourney(pm, new Map(), []);
    expect(plan.length).toBeGreaterThanOrEqual(pm.journey.length);
    expect(plan[0].key).toBe('product-foundation');
    expect(plan.every((m) => m.isNew)).toBe(true);
    expect(plan.every((m) => m.quests.length > 0)).toBe(true);
    const orders = plan.map((m) => m.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it('adds up to two extra milestones for critical gaps the template does not cover', () => {
    const gaps = [
      { slug: 'public-speaking', severity: 5 },
      { slug: 'spreadsheets', severity: 4 },
      { slug: 'design-systems', severity: 1 },
    ];
    const extra = planJourney(pm, new Map(), gaps).filter((m) => m.key.startsWith('skill:') && !pm.journey.some((t) => t.key === m.key));
    expect(extra.map((m) => m.key)).toEqual(['skill:public-speaking', 'skill:spreadsheets']);
  });

  it('is idempotent: milestones and quests that already exist are not planned again', () => {
    const first = planJourney(pm, new Map(), []);
    const existing = { milestones: new Map(first.map((m) => [m.key, new Set(m.quests.map((q) => q.key))])) };
    expect(planJourney(pm, new Map(), [], existing)).toEqual([]);
  });

  it('marks skill quests as pre-completed when the user already meets the requirement', () => {
    const skillQuest = pm.journey.flatMap((m) => m.quests).find((q) => q.category === 'SKILL' && q.skillSlug && pm.requirements.some((r) => r.skill === q.skillSlug))!;
    const find = (levels: Map<string, number>) =>
      planJourney(pm, levels, [])
        .flatMap((m) => m.quests)
        .find((q) => q.key === skillQuest.key)!;
    expect(find(new Map()).preCompleted).toBe(false);
    expect(find(new Map([[skillQuest.skillSlug!, 100]])).preCompleted).toBe(true);
  });

  describe('Add skill to Journey', () => {
    it('uses the role template milestone for a known gap and never pre-completes it', () => {
      const m = planSkillAddition(pm, 'product-analytics', new Map([['product-analytics', 99]]), { milestones: new Map() })!;
      expect(m.key).toBe('skill:product-analytics');
      expect(m.isNew).toBe(true);
      expect(m.quests).toHaveLength(1);
      expect(m.quests[0].preCompleted).toBe(false);
    });

    it('returns null when the quest is already in the journey', () => {
      const first = planSkillAddition(pm, 'product-analytics', new Map(), { milestones: new Map() })!;
      const existing = { milestones: new Map([[first.key, new Set(first.quests.map((q) => q.key))]]) };
      expect(planSkillAddition(pm, 'product-analytics', new Map(), existing)).toBeNull();
    });

    it('places an off-template skill just before the portfolio milestone', () => {
      const m = planSkillAddition(pm, 'public-speaking', new Map(), { milestones: new Map() })!;
      const portfolioIdx = pm.journey.findIndex((t) => t.key === 'portfolio');
      expect(m.order).toBe(portfolioIdx * 10 - 1);
    });
  });

  it('derives quest and milestone progress from tasks', () => {
    expect(questProgressFromTasks([])).toBe(0);
    expect(questProgressFromTasks([{ completed: true }, { completed: false }, { completed: false }, { completed: false }])).toBe(25);
    expect(milestoneProgress([{ progress: 100 }, { progress: 50 }])).toBe(75);
    expect(milestoneProgress([])).toBe(0);
  });
});
