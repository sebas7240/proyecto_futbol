import { describe, expect, it } from 'vitest';
import { publicArtistImage } from './rights.js';

describe('artist image rights', () => {
  it('hides images without an approved usage basis', () => {
    expect(publicArtistImage('https://example.com/photo.jpg', 'unverified')).toBe(
      ''
    );
    expect(publicArtistImage('https://example.com/photo.jpg', 'none')).toBe('');
  });

  it('publishes only images explicitly approved by rights status', () => {
    expect(
      publicArtistImage('https://example.com/photo.jpg', 'licensed')
    ).toBe('https://example.com/photo.jpg');
    expect(
      publicArtistImage(
        'https://example.com/provider.jpg',
        'provider_authorized'
      )
    ).toBe('https://example.com/provider.jpg');
  });
});
