import { businessTypeCatalog, presetForBusiness } from './business-types';
describe('Business presentation presets', () => {
  it('covers every existing stable onboarding key without granting capabilities', () => {
    const rows = businessTypeCatalog();
    expect(rows.length).toBeGreaterThan(18);
    for (const row of rows) {
      expect(row.preset.key).toBe(row.code);
      expect(row.preset.recommendedUnits.length).toBeGreaterThan(0);
      expect(row.preset.recommendedCapabilities).toEqual([
        ...row.suggested_features,
      ]);
      expect((row.preset as any).enabled).toBeUndefined();
    }
  });
  it('prioritizes grocery pack, pharmacy strip, hardware length and footwear pair units', () => {
    expect(
      presetForBusiness('GROCERY')
        .recommendedCategories.find(
          (c) => c.name === 'Biscuits / Packaged Food',
        )!
        .units.slice(0, 3),
    ).toEqual(['PKT', 'BOX', 'PCS']);
    expect(presetForBusiness('PHARMACY').recommendedUnits).toContain('STRIP');
    expect(presetForBusiness('HARDWARE').recommendedUnits).toContain('FT');
    expect(presetForBusiness('FOOTWEAR').recommendedUnits[0]).toBe('PAIR');
  });
  it('uses category recommendations and contextual clothing wording without changing facts', () => {
    expect(
      presetForBusiness('GROCERY').recommendedCategories.find(
        (c) => c.name === 'Rice / Grains',
      )!.units,
    ).toContain('KG');
    expect(presetForBusiness('CLOTHING').itemPrompts.variants).toContain(
      'sizes',
    );
    expect(presetForBusiness('PHARMACY').recommendationPriority[0]).toBe(
      'EXPIRED_BATCH',
    );
  });
  it('keeps unrecognised legacy types usable through generic recommendations', () => {
    expect(presetForBusiness(null).key).toBe('OTHER');
    expect(presetForBusiness('Unknown legacy shop').recommendedUnits).toContain(
      'PCS',
    );
    expect(presetForBusiness('GARMENTS').recommendedUnits).toContain('SET');
  });
});
