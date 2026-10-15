import {
  rankRecommendations,
  type Recommendation,
} from './retail-experience.service';
const row = (
  id: string,
  score: number,
  critical = false,
  kind = 'LOW_STOCK',
): Recommendation => ({
  id,
  score,
  critical,
  kind,
  category: 'DO_NOW',
  tone: 'info',
  title: id,
  description: 'Recorded fact',
  why: 'Saved record',
  action: { label: 'Review', path: '/retail/items' },
  facts: {},
});
describe('Deterministic daily suggestion priority', () => {
  it('limits the feed to three and prioritizes critical recorded risks', () => {
    const rows = [
      row('improve', 430),
      row('expired', 1000, true, 'EXPIRED_BATCH'),
      row('galla', 970, true, 'GALLA_MISMATCH'),
      row('fast', 960, true),
      row('due', 730),
    ];
    expect(rankRecommendations(rows, []).map((r) => r.id)).toEqual([
      'expired',
      'galla',
      'fast',
    ]);
  });
  it('snoozes ordinary suggestions while retaining an unresolved critical one', () => {
    expect(
      rankRecommendations(
        [row('ordinary', 800), row('critical', 970, true)],
        [],
        ['ordinary', 'critical'],
      ).map((r) => r.id),
    ).toEqual(['critical']);
  });
  it('uses the preset only to break close scores, never to outrank a cash mismatch', () => {
    const rows = [
      row('cost', 800, false, 'UNKNOWN_COST'),
      row('expiry', 800, false, 'EXPIRING_BATCH'),
      row('galla', 970, true, 'GALLA_MISMATCH'),
    ];
    expect(
      rankRecommendations(rows, ['EXPIRING_BATCH']).map((r) => r.id),
    ).toEqual(['galla', 'expiry', 'cost']);
  });
});
