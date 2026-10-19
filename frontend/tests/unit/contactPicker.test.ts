import { describe, expect, it } from 'vitest';
import { chosenContact, contactPhone } from '../../src/retail/components/contactPicker';

describe('Selected customer contact', () => {
  it('normalizes an Indian mobile without changing its digits', () => {
    expect(contactPhone('+91 98765-43210')).toBe('9876543210');
    expect(contactPhone('09876543210')).toBe('9876543210');
  });
  it('preserves international country codes and explicit extensions', () => {
    expect(contactPhone('+44 (20) 7946-0958')).toBe('+442079460958');
    expect(contactPhone('01123456789 ext 12')).toBe('01123456789 ext 12');
  });
  it('keeps distinct phone numbers available for an explicit choice', () => {
    expect(chosenContact({name:[' Ramesh '],tel:['+91 98765 43210','9876543210','9123456780']}))
      .toEqual({name:'Ramesh',phones:['9876543210','9123456780']});
  });
  it('handles a user sharing no name or number without inventing values', () => {
    expect(chosenContact({name:[],tel:[]})).toEqual({name:'',phones:[]});
    expect(chosenContact({})).toEqual({name:'',phones:[]});
  });
});
