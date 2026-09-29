import { useState } from 'react';
import { uid } from '../lib/format';
import { resizeImage } from '../lib/media';
import { update, useAppState } from '../store/store';
import { sportOf } from '../data/sports';
import type { Role } from '../types';

const BOWLING = ['Right-arm fast', 'Right-arm medium', 'Off spin', 'Leg spin', 'Left-arm fast', 'Left-arm spin', 'Does not bowl'];
const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

/** Public form players fill themselves. New entries stay "on hold" until the organiser reviews them. */
export function Register() {
  const { settings, players, categories } = useAppState();
  const sport = sportOf(settings.sport);
  const ROLES = sport.roles;
  const [form, setForm] = useState({ name: '', age: '', mobile: '', role: '' as Role | '', batting: 'Right hand', bowling: BOWLING[0]!, jerseyName: '', jerseyNo: '', tshirt: 'M', photo: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  if (!settings.selfRegistration) {
    return <div className="phone"><div className="empty">Registration is closed.</div></div>;
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Please enter your full name.');
    if (!/^\d{10}$/.test(form.mobile.replace(/\D/g, ''))) return setError('Please enter a 10-digit mobile number.');
    if (!form.role) return setError('Please choose your playing role.');
    if (players.some((p) => p.mobile && p.mobile.replace(/\D/g, '') === form.mobile.replace(/\D/g, ''))) {
      return setError('This mobile number is already registered.');
    }
    update((s) =>
      void s.players.push({
        id: uid('p'),
        no: Math.max(100, ...s.players.map((p) => p.no)) + 1,
        name: form.name.trim(),
        age: form.age ? Number(form.age) : undefined,
        mobile: form.mobile.replace(/\D/g, ''),
        role: form.role as Role,
        batting: sport.hasBatBowl ? form.batting : '',
        bowling: !sport.hasBatBowl ? '' : form.bowling === 'Does not bowl' ? '—' : form.bowling,
        categoryId: categories[categories.length - 1]!.id,
        tag: '',
        jerseyName: form.jerseyName,
        jerseyNo: form.jerseyNo,
        tshirt: form.tshirt,
        photo: form.photo || undefined,
        status: 'hold',
        teamId: null,
        price: null,
        previousTeamId: null,
        selfRegistered: true,
      }),
    );
    setDone(true);
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
          <div className="banner banner-green" style={{ fontSize: 16 }}><strong>Thank you, {form.name}!</strong> You are registered.</div>
          <p className="muted" style={{ margin: 0 }}>The organiser will review your details and assign your category before auction day.</p>
          <button className="btn" onClick={() => { setDone(false); setForm((f) => ({ ...f, name: '', mobile: '', age: '', photo: '', jerseyName: '', jerseyNo: '' })); }}>Register another player</button>
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
            <label className="field">Age<input className="input" inputMode="numeric" value={form.age} onChange={(e) => set('age', e.target.value.replace(/\D/g, ''))} /></label>
            <label className="field">Mobile *<input className="input" type="tel" value={form.mobile} onChange={(e) => set('mobile', e.target.value)} placeholder="10-digit number" autoComplete="tel" /></label>
          </div>
          <div className="field">
            Playing role *
            <div className="choice-grid" role="group" aria-label="Playing role">
              {ROLES.map((r) => (
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
            <label className="field">Jersey name<input className="input" value={form.jerseyName} onChange={(e) => set('jerseyName', e.target.value.toUpperCase())} /></label>
            <label className="field">Number<input className="input" inputMode="numeric" value={form.jerseyNo} onChange={(e) => set('jerseyNo', e.target.value.replace(/\D/g, ''))} /></label>
          </div>
          <div className="field">
            T-shirt size
            <div className="row" role="group" aria-label="T-shirt size" style={{ gap: 6, flexWrap: 'nowrap' }}>
              {SIZES.map((s) => (
                <button key={s} type="button" className="choice" style={{ flex: 1 }} aria-pressed={form.tshirt === s} onClick={() => set('tshirt', s)}>{s}</button>
              ))}
            </div>
          </div>
          {error && <div className="banner banner-red" role="alert">{error}</div>}
          <button className="btn btn-primary" type="submit" style={{ minHeight: 52, fontSize: 16 }}>Submit registration</button>
          <p className="hint" style={{ textAlign: 'center' }}>The organiser will review and assign your category.</p>
        </form>
      )}
    </div>
  );
}
