import { safeString } from './approval-form.builder';

describe('safeString', () => {
  it('returns empty string for null or undefined', () => {
    expect(safeString(null)).toBe('');
    expect(safeString(undefined)).toBe('');
  });

  it('returns string for primitive types', () => {
    expect(safeString('hello')).toBe('hello');
    expect(safeString(42)).toBe('42');
    expect(safeString(false)).toBe('false');
  });

  it('joins array items recursively', () => {
    expect(safeString(['a', 'b', 'c'])).toBe('a,b,c');
    expect(safeString([1, 2, 3])).toBe('1,2,3');
  });

  it('stringifies objects', () => {
    const obj = { foo: 'bar' };
    expect(safeString(obj)).toBe(JSON.stringify(obj));
  });
});
