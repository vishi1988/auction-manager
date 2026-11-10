import { describe, expect, it } from 'vitest';
import { createDummyState } from '../data/dummy';
import { diffPhotos, mergePhotos, splitPhotos } from './photos';

function stateWithImages() {
  const s = createDummyState('cricket', { name: 'Test League' });
  s.players[0]!.photo = 'data:image/jpeg;base64,AAA';
  s.players[2]!.photo = 'data:image/jpeg;base64,BBB';
  s.teams[1]!.logo = 'data:image/jpeg;base64,CCC';
  return s;
}

describe('photos kept apart from the auction record', () => {
  it('takes every image out of the record', () => {
    const s = stateWithImages();
    const { lean, photos } = splitPhotos(s);
    expect(Object.keys(photos)).toHaveLength(3);
    expect(JSON.stringify(lean)).not.toContain('data:image');
    expect(lean.players.every((p) => !('photo' in p) || !p.photo)).toBe(true);
    expect(lean.teams.every((t) => !t.logo)).toBe(true);
  });

  it('does not change the auction it was given', () => {
    const s = stateWithImages();
    splitPhotos(s);
    expect(s.players[0]!.photo).toBe('data:image/jpeg;base64,AAA');
    expect(s.teams[1]!.logo).toBe('data:image/jpeg;base64,CCC');
  });

  it('gives back the same auction after split and merge', () => {
    const s = stateWithImages();
    const { lean, photos } = splitPhotos(s);
    expect(mergePhotos(lean, photos)).toEqual(s);
  });

  it('keeps a player and a team apart even if their ids match', () => {
    const s = stateWithImages();
    s.teams[1]!.id = s.players[0]!.id;
    const { lean, photos } = splitPhotos(s);
    const back = mergePhotos(lean, photos);
    expect(back.players[0]!.photo).toBe('data:image/jpeg;base64,AAA');
    expect(back.teams[1]!.logo).toBe('data:image/jpeg;base64,CCC');
  });

  it('sends only the images that changed', () => {
    const before = { a: '1', b: '2', c: '3' };
    const after = { a: '1', b: 'changed', d: 'new' };
    expect(diffPhotos(before, after)).toEqual({ put: { b: 'changed', d: 'new' }, remove: ['c'] });
    expect(diffPhotos(after, after)).toEqual({ put: {}, remove: [] });
  });
});
