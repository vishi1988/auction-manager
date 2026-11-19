import { ImagePlus, Plus, Trash2 } from 'lucide-react';
import { uid } from '../lib/format';
import { resizeImage } from '../lib/media';
import { update } from '../store/store';
import type { Sponsor } from '../types';

export const MAX_SPONSORS = 8;

/** Add, rename and remove the tournament's sponsors (Settings → Live screen). */
export function SponsorsEditor({ sponsors }: { sponsors: Sponsor[] }) {
  const patch = (id: string, change: Partial<Sponsor>) =>
    update((s) => {
      const x = s.sponsors?.find((sp) => sp.id === id);
      if (x) Object.assign(x, change);
    });

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {sponsors.map((sp) => (
        <div key={sp.id} className="row" style={{ flexWrap: 'nowrap', gap: 10 }}>
          <label className="sponsor-logo-pick" title="Choose logo">
            {sp.logo ? <img src={sp.logo} alt="" /> : <ImagePlus size={18} />}
            <input
              type="file"
              accept="image/*"
              hidden
              aria-label={'Logo of ' + (sp.name || 'sponsor')}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) patch(sp.id, { logo: await resizeImage(f, 320, '#ffffff') });
              }}
            />
          </label>
          <input className="input" maxLength={40} aria-label="Sponsor name" placeholder="Sponsor name, e.g. Sai Sports" value={sp.name} onChange={(e) => patch(sp.id, { name: e.target.value })} />
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            aria-label={'Remove ' + (sp.name || 'sponsor')}
            title="Remove"
            onClick={() => update((s) => void (s.sponsors = (s.sponsors ?? []).filter((x) => x.id !== sp.id)))}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      {sponsors.length < MAX_SPONSORS ? (
        <button type="button" className="btn btn-sm" style={{ justifySelf: 'start' }} onClick={() => update((s) => void (s.sponsors = [...(s.sponsors ?? []), { id: uid('s'), name: '' }]))}>
          <Plus size={15} />Add sponsor
        </button>
      ) : (
        <p className="hint">Up to {MAX_SPONSORS} sponsors.</p>
      )}
    </div>
  );
}

/** Sponsors worth showing: those with a name or a logo. */
export const shownSponsors = (sponsors: Sponsor[] | undefined) => (sponsors ?? []).filter((s) => s.logo || s.name.trim());

/** One sponsor as a logo on a white plate, or its name when there is no logo. */
export function SponsorChip({ sponsor, className = 'sponsor-chip' }: { sponsor: Sponsor; className?: string }) {
  return <span className={className + (sponsor.logo ? ' has-logo' : '')}>{sponsor.logo ? <img src={sponsor.logo} alt={sponsor.name} /> : sponsor.name}</span>;
}
