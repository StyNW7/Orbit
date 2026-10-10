import { L, currentLocale, localeMiddleware, parseLocale, withLocale } from './locale';
import { detectIntent } from '../../modules/agent/planner.engine';
import { parseWhen } from '../../modules/agent/tool-registry.service';
import { computeJobMatch, type MatchJob, type MatchUser } from '../../modules/opportunities/job-match.engine';

describe('request locale', () => {
  it('parses supported language tags', () => {
    expect(parseLocale('id')).toBe('id');
    expect(parseLocale('ID-id')).toBe('id');
    expect(parseLocale('en-US,en;q=0.9')).toBe('en');
    expect(parseLocale(['id'])).toBe('id');
    expect(parseLocale('fr')).toBeNull();
    expect(parseLocale(undefined)).toBeNull();
  });

  it('defaults to English outside a request', () => {
    expect(currentLocale()).toBe('en');
    expect(L('Open', 'Buka')).toBe('Open');
  });

  it('picks the active language inside withLocale', () => {
    expect(withLocale('id', () => L('Open', 'Buka'))).toBe('Buka');
    expect(withLocale('en', () => L('Open', 'Buka'))).toBe('Open');
  });

  it('keeps the locale across awaits', async () => {
    const result = await withLocale('id', async () => {
      await new Promise((r) => setTimeout(r, 5));
      return currentLocale();
    });
    expect(result).toBe('id');
  });

  it('middleware reads X-Orbit-Locale, then Accept-Language', (done) => {
    const req = { headers: { 'accept-language': 'id-ID,id;q=0.9' } } as never;
    localeMiddleware(req, {} as never, () => {
      expect(currentLocale()).toBe('id');
      const req2 = { headers: { 'x-orbit-locale': 'en', 'accept-language': 'id' } } as never;
      localeMiddleware(req2, {} as never, () => {
        expect(currentLocale()).toBe('en');
        done();
      });
    });
  });
});

describe('Indonesian agent phrasing', () => {
  it('routes the Indonesian suggestion chips to the same intents', () => {
    expect(detectIntent('Apa yang harus aku fokuskan minggu ini?')).toBe('focus');
    expect(detectIntent('Gap mana yang sebaiknya aku tutup lebih dulu?')).toBe('gaps');
    expect(detectIntent('Rekomendasikan buku untuk gap terbesarku')).toBe('books');
    expect(detectIntent('Magang mana yang paling cocok untukku?')).toBe('jobs');
    expect(detectIntent('Carikan workshop untuk gap terbesarku')).toBe('growth');
    expect(detectIntent('Ingatkan aku untuk follow up dalam 2 hari')).toBe('reminder');
    expect(detectIntent('Role model mana yang jalurnya mirip denganku?')).toBe('people');
    expect(detectIntent('Kenapa skill ini penting?', { page: 'universe', entityType: 'node' })).toBe('node');
    expect(detectIntent('Apakah aku sudah siap melamar?', { page: 'discover', entityType: 'job' })).toBe('job_readiness');
  });

  it('understands Indonesian reminder times', () => {
    const now = new Date('2026-10-10T08:00:00');
    expect(parseWhen('dalam 2 hari', now)?.getDate()).toBe(12);
    expect(parseWhen('3 hari lagi', now)?.getDate()).toBe(13);
    expect(parseWhen('besok jam 19:00', now)?.getHours()).toBe(19);
  });
});

describe('localized job match explanations', () => {
  const job: MatchJob = {
    title: 'Product Intern',
    description: 'Work with product managers',
    skills: ['sql'],
    roleSlugs: ['product-manager'],
    workMode: 'HYBRID',
    employmentType: 'INTERNSHIP',
    location: 'Jakarta',
    seniority: 'ENTRY',
    industry: null,
  };
  const user: MatchUser = {
    skillLevels: new Map(),
    skillNames: new Map([['sql', 'SQL']]),
    primaryRole: { slug: 'product-manager', title: 'Product Manager', keywords: ['product'] },
    otherRoleSlugs: [],
    experiences: [{ type: 'LEADERSHIP', months: 12 }],
    isStudent: true,
    technicalBackground: false,
    preferences: { workModes: [], roleTypes: [], locations: [], industries: [] },
    journeySkillSlugs: new Set(),
  };

  it('keeps scores identical while translating the copy', () => {
    const en = computeJobMatch(job, user);
    const id = withLocale('id', () => computeJobMatch(job, user));
    expect(id.overall).toBe(en.overall);
    expect(en.reasons).toContain('Leadership');
    expect(id.reasons).toContain('Kepemimpinan');
    expect(en.recommendedAction).toBe('Add SQL to Journey');
    expect(id.recommendedAction).toBe('Tambahkan SQL ke Journey');
  });
});
