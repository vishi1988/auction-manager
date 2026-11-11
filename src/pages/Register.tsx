import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { resizeImage } from '../lib/media';
import { TSHIRT_SIZES } from '../lib/registration';
import { submitRegistration, useAppState, type RegistrationResult } from '../store/store';
import { sportOf } from '../data/sports';
import type { ExtraTshirt, Role } from '../types';

const BOWLING = ['Right-arm fast', 'Right-arm medium', 'Off spin', 'Leg spin', 'Left-arm fast', 'Left-arm spin', 'Does not bowl'];
const OTHER = 'Other';

/** A size being chosen: one of the standard sizes, or "Other" with the size typed in. */
interface SizeChoice { pick: string; custom: string }
const sizeOf = (s: SizeChoice) => (s.pick === OTHER ? s.custom.trim() : s.pick);

interface ExtraRow { key: number; who: ExtraTshirt['who']; name: string; size: SizeChoice; jerseyName: string; jerseyNo: string }

const PROBLEMS: Record<Exclude<RegistrationResult, 'ok'>, string> = {
  already_registered: 'This mobile number is already registered.',
  closed: 'Registration is closed.',
  offline: 'No internet right now. Please check your connection and submit again.',
  failed: 'Could not send the form. Please try again in a minute.',
};

const blank = { name: '', age: '', mobile: '', role: '' as Role | '', batting: 'Right hand', bowling: BOWLING[0]!, jerseyName: '', jerseyNo: '', photo: '' };

/** Public form players fill themselves. New entries stay "on hold" until the organiser reviews them. */
export function Register() {
  const { settings } = useAppState();
  const sport = sportOf(settings.sport);
  const [form, setForm] = useState(blank);
  const [tshirt, setTshirt] = useState<SizeChoice>({ pick: 'M', custom: '' });
  const [extras, setExtras] = useState<ExtraRow[]>([]);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState('');
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const setExtra = (key: number, patch: Partial<ExtraRow>) => setExtras((list) => list.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const addExtra = (who: ExtraTshirt['who']) =>
    setExtras((list) => [...list, { key: Date.now() + list.length, who, name: '', size: { pick: 'M', custom: '' }, jerseyName: '', jerseyNo: '' }]);

  if (!settings.selfRegistration) {
    return <div className="phone"><div className="empty">Registration is closed.</div></div>;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    if (!form.name.trim()) return setError('Please enter your full name.');
    if (!/^\d{10}$/.test(form.mobile.replace(/\D/g, ''))) return setError('Please enter a 10-digit mobile number.');
    if (!form.role) return setError('Please choose your playing role.');
    if (!sizeOf(tshirt)) return setError('Please type your T-shirt size.');
    for (const [i, x] of extras.entries()) {
      if (x.who === 'other' && !x.name.trim()) return setError(`Extra T-shirt ${i + 1}: please enter the person's name.`);
      if (!sizeOf(x.size)) return setError(`Extra T-shirt ${i + 1}: please type the size.`);
    }
    setError('');
    setSending(true);
    const result = await submitRegistration({
      name: form.name.trim(),
      age: form.age ? Number(form.age) : undefined,
      mobile: form.mobile.replace(/\D/g, ''),
      role: form.role,
      batting: sport.hasBatBowl ? form.batting : '',
      bowling: !sport.hasBatBowl ? '' : form.bowling === 'Does not bowl' ? '—' : form.bowling,
      jerseyName: form.jerseyName,
      jerseyNo: form.jerseyNo,
      tshirt: sizeOf(tshirt),
      extraTshirts: extras.map((x) => ({
        who: x.who,
        name: x.who === 'other' ? x.name.trim() : '',
        size: sizeOf(x.size),
        jerseyName: x.jerseyName.trim(),
        jerseyNo: x.jerseyNo,
      })),
      photo: form.photo || undefined,
    });
    setSending(false);
    if (result !== 'ok') return setError(PROBLEMS[result]);
    setDone(form.name.trim());
    setForm(blank);
    setTshirt({ pick: 'M', custom: '' });
    setExtras([]);
  };

  return (
    <div className="phone">
      <header style={{ padding: '20px 20px 24px', background: 'var(--ink)', color: 'var(--ground)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="row" style={{ gap: 10 }}>
          <span className="logo" style={{ width: 30, height: 30, fontSize: 15 }}>{settings.name.slice(0, 2).toUpperCase()}</span>
          <span className="display" style={{ fontSize: 17, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{settings.name}</span>
        </span>
        <h1 className="display" style={{ fontSize: 32, lineHeight: 1, marginTop: 8 }}>Player Registration</h1>
        <p style={{ margin: 0, fontSize: 13, color: '#93a3bb' }}>Fill in your details for the auction. No login needed.</p>
      </header>

      {done ? (
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="banner banner-green" style={{ fontSize: 16 }}><strong>Thank you, {done}!</strong> You are registered.</div>
          <p className="muted" style={{ margin: 0 }}>The organiser will review your details and assign your category before auction day.</p>
          <button className="btn" onClick={() => setDone('')}>Register another player</button>
        </div>
      ) : (
        <form onSubmit={submit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="row">
            <span className="avatar" style={{ width: 84, height: 84, fontSize: 13, border: '2px dashed #b7b0a1' }}>
              {form.photo ? <img src={form.photo} alt="Your photo" /> : 'Photo'}
            </span>
            <label className="btn">
              {form.photo ? 'Change photo' : 'Upload photo'}
              <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) set('photo', await resizeImage(f)); }} />
            </label>
          </div>
          <label className="field">Full name *<input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="As it should appear on screen" autoComplete="name" /></label>
          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 12 }}>
            <label className="field">Age<input className="input" inputMode="numeric" maxLength={2} value={form.age} onChange={(e) => set('age', e.target.value.replace(/\D/g, ''))} /></label>
            <label className="field">Mobile *<input className="input" type="tel" value={form.mobile} onChange={(e) => set('mobile', e.target.value)} placeholder="10-digit number" autoComplete="tel" /></label>
          </div>
          <div className="field">
            Playing role *
            <div className="choice-grid" role="group" aria-label="Playing role">
              {sport.roles.map((r) => (
                <button key={r} type="button" className="choice" aria-pressed={form.role === r} onClick={() => set('role', r)}>{r}</button>
              ))}
            </div>
          </div>
          {sport.hasBatBowl && (
            <div className="grid-2">
              <label className="field">Batting
                <select className="select" value={form.batting} onChange={(e) => set('batting', e.target.value)}><option>Right hand</option><option>Left hand</option></select>
              </label>
              <label className="field">Bowling
                <select className="select" value={form.bowling} onChange={(e) => set('bowling', e.target.value)}>{BOWLING.map((b) => <option key={b}>{b}</option>)}</select>
              </label>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 12 }}>
            <label className="field">Jersey name<input className="input" maxLength={24} value={form.jerseyName} onChange={(e) => set('jerseyName', e.target.value.toUpperCase())} /></label>
            <label className="field">Number<input className="input" inputMode="numeric" maxLength={4} value={form.jerseyNo} onChange={(e) => set('jerseyNo', e.target.value.replace(/\D/g, ''))} /></label>
          </div>
          <div className="field">
            T-shirt size
            <div className="row" role="group" aria-label="T-shirt size" style={{ gap: 6, flexWrap: 'wrap' }}>
              {[...TSHIRT_SIZES, OTHER].map((s) => (
                <button key={s} type="button" className="choice" style={{ flex: '1 0 auto' }} aria-pressed={tshirt.pick === s} onClick={() => setTshirt((t) => ({ ...t, pick: s }))}>{s}</button>
              ))}
            </div>
            {tshirt.pick === OTHER && (
              <input className="input" style={{ marginTop: 8 }} autoFocus maxLength={20} aria-label="Your T-shirt size" placeholder="Type your size, e.g. 3XL, 44 inch, Kids 30" value={tshirt.custom} onChange={(e) => setTshirt((t) => ({ ...t, custom: e.target.value }))} />
            )}
          </div>

          <div className="field" style={{ gap: 10 }}>
            <span>
              Extra T-shirts <span className="muted" style={{ fontWeight: 400 }}>(optional)</span>
            </span>
            <span className="hint" style={{ marginTop: -6 }}>Want one more for yourself, or one for family, friends or supporters who are not playing? Add them here.</span>
            {extras.map((x, i) => (
              <div key={x.key} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface-2)' }}>
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <strong style={{ fontSize: 14 }}>Extra T-shirt {i + 1}</strong>
                  <span className="spacer" />
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={`Remove extra T-shirt ${i + 1}`} onClick={() => setExtras((list) => list.filter((y) => y.key !== x.key))}><Trash2 size={15} /></button>
                </div>
                <div className="row" role="group" aria-label="Who is it for" style={{ gap: 6, flexWrap: 'nowrap' }}>
                  <button type="button" className="choice" style={{ flex: 1 }} aria-pressed={x.who === 'player'} onClick={() => setExtra(x.key, { who: 'player' })}>For me</button>
                  <button type="button" className="choice" style={{ flex: 1 }} aria-pressed={x.who === 'other'} onClick={() => setExtra(x.key, { who: 'other' })}>Non-player</button>
                </div>
                {x.who === 'other' && (
                  <label className="field">Person's name *<input className="input" maxLength={80} value={x.name} onChange={(e) => setExtra(x.key, { name: e.target.value })} placeholder="Who is this T-shirt for?" /></label>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: x.size.pick === OTHER ? '110px 1fr' : '1fr', gap: 12 }}>
                  <label className="field">Size
                    <select className="select" value={x.size.pick} onChange={(e) => setExtra(x.key, { size: { ...x.size, pick: e.target.value } })}>
                      {[...TSHIRT_SIZES, OTHER].map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </label>
                  {x.size.pick === OTHER && (
                    <label className="field">Type the size *<input className="input" maxLength={20} placeholder="e.g. 3XL, Kids 30" value={x.size.custom} onChange={(e) => setExtra(x.key, { size: { ...x.size, custom: e.target.value } })} /></label>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 12 }}>
                  <label className="field">Name on shirt<input className="input" maxLength={24} placeholder={x.who === 'player' ? form.jerseyName || 'Same as mine' : ''} value={x.jerseyName} onChange={(e) => setExtra(x.key, { jerseyName: e.target.value.toUpperCase() })} /></label>
                  <label className="field">Number<input className="input" inputMode="numeric" maxLength={4} placeholder={x.who === 'player' ? form.jerseyNo : ''} value={x.jerseyNo} onChange={(e) => setExtra(x.key, { jerseyNo: e.target.value.replace(/\D/g, '') })} /></label>
                </div>
              </div>
            ))}
            {extras.length < 20 && (
              <div className="row" style={{ gap: 8 }}>
                <button type="button" className="btn btn-sm" onClick={() => addExtra('player')}><Plus size={15} />Extra for me</button>
                <button type="button" className="btn btn-sm" onClick={() => addExtra('other')}><Plus size={15} />For a non-player</button>
              </div>
            )}
          </div>

          {error && <div className="banner banner-red" role="alert">{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={sending} style={{ minHeight: 52, fontSize: 16 }}>{sending ? 'Sending…' : 'Submit registration'}</button>
          <p className="hint" style={{ textAlign: 'center' }}>The organiser will review and assign your category.</p>
        </form>
      )}
    </div>
  );
}
