import { ActionExecutorService } from './action-executor.service';

type Row = Record<string, unknown> & { id: string; userId: string; status: string };

/** Minimal in-memory stand-in for the Prisma calls the executor makes. */
function setup(actions: Row[]) {
  const rows = new Map(actions.map((a) => [a.id, { ...a }]));
  const prisma = {
    agentAction: {
      findFirst: jest.fn(async ({ where }: { where: { id: string; userId: string } }) => {
        const row = rows.get(where.id);
        return row && row.userId === where.userId ? row : null;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = { ...rows.get(where.id)!, ...data } as Row;
        rows.set(where.id, row);
        return row;
      }),
    },
    agentInsight: { updateMany: jest.fn(async () => ({ count: 0 })) },
  };
  const journeys = { addSkill: jest.fn(async () => ({ message: 'Added Product Analytics to your journey.', questId: 'q1' })) };
  const service = new ActionExecutorService(
    prisma as never,
    journeys as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, prisma, journeys, rows };
}

const pending = (overrides: Partial<Row> = {}): Row => ({
  id: 'a1',
  userId: 'u1',
  type: 'ADD_SKILL_TO_JOURNEY',
  tool: 'build_career_journey',
  level: 'WRITE',
  title: 'Add Product Analytics to Journey',
  description: null,
  inputSummary: null,
  outputSummary: null,
  payload: { skillSlug: 'product-analytics' },
  status: 'PENDING_CONFIRMATION',
  confirmationRequired: true,
  confirmedAt: null,
  executedAt: null,
  error: null,
  messageId: null,
  createdAt: new Date(),
  ...overrides,
});

describe('Agent action confirmation (human-in-the-loop)', () => {
  it('executes a pending write only when the owner confirms it, then records the confirmation', async () => {
    const { service, journeys, rows } = setup([pending()]);
    const result = await service.confirm('u1', 'a1');
    expect(journeys.addSkill).toHaveBeenCalledWith('u1', 'product-analytics');
    expect(result.navigateTo).toBe('/app/journey?quest=q1');
    expect(rows.get('a1')).toMatchObject({ status: 'CONFIRMED', outputSummary: 'Added Product Analytics to your journey.' });
    expect(rows.get('a1')!.confirmedAt).toBeInstanceOf(Date);
  });

  it("refuses to confirm another user's action", async () => {
    const { service, journeys } = setup([pending()]);
    await expect(service.confirm('intruder', 'a1')).rejects.toThrow();
    expect(journeys.addSkill).not.toHaveBeenCalled();
  });

  it('cannot confirm an action twice', async () => {
    const { service, journeys } = setup([pending({ status: 'CONFIRMED' })]);
    await expect(service.confirm('u1', 'a1')).rejects.toThrow(/already confirmed/);
    expect(journeys.addSkill).not.toHaveBeenCalled();
  });

  it('rejecting leaves user data untouched', async () => {
    const { service, journeys, rows } = setup([pending()]);
    await service.reject('u1', 'a1');
    expect(rows.get('a1')!.status).toBe('REJECTED');
    expect(journeys.addSkill).not.toHaveBeenCalled();
    await expect(service.confirm('u1', 'a1')).rejects.toThrow();
  });

  it('marks the action FAILED when execution throws', async () => {
    const { service, journeys, rows } = setup([pending()]);
    journeys.addSkill.mockRejectedValueOnce(new Error('Database unavailable'));
    await expect(service.confirm('u1', 'a1')).rejects.toThrow('Database unavailable');
    expect(rows.get('a1')).toMatchObject({ status: 'FAILED', error: 'Database unavailable' });
  });
});
