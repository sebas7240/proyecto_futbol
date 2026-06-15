import { describe, expect, it } from 'vitest';
import { cleanCategories } from './interests.js';

describe('user interests', () => {
  it('keeps only supported categories and removes duplicates', () => {
    expect(
      cleanCategories(['musica', 'creadores', 'musica', 'unknown'])
    ).toEqual(['musica', 'creadores']);
  });
});
