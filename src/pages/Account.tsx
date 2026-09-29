import { useRef, useState } from 'react';
import { Toast, useToast } from '../components/ui';
import { exportAccount, importAccount, updateIndex, useIndex, type AccountBackup } from '../store/store';
import type { Organizer } from '../types';

export function Account() {
  const { organizer, auctions } = useIndex();
  const [form, setForm] = useState<Organizer>(organizer);
  const [toast, showToast] = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof Organizer, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.mobile && !/^\d{10}$/.test(form.mobile.replace(/\D/g, ''))) return showToast('Enter a 10-digit mobile number');
    updateIndex((d) => void (d.organizer = { ...form, mobile: form.mobile.replace(/\D/g, '') }));
    showToast('Profile saved');
  };

  const download = () => {
    const blob = new Blob([JSON.stringify(exportAccount())], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'my-auctions-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const restore = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as AccountBackup;
      if (data.kind !== 'auction-account-backup') throw new Error('wrong file');
      const n = importAccount(data);
      showToast(`Restored ${n} auction${n === 1 ? '' : 's'}`);
    } catch {
      showToast('That file is not an account backup');
    }
  };

  return (
    <main className="page" style={{ maxWidth: 960 }}>
      <div className="page-head">
        <div>
          <h1>Account</h1>
          <p>Your organiser details and data.</p>
        </div>
      </div>

      <form className="card" onSubmit={save}>
        <h2>Organiser profile</h2>
        <div className="grid-2">
          <label className="field">Your name<input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" /></label>
          <label className="field">Organisation / club<input className="input" placeholder="e.g. Shivaji Nagar Sports Club" value={form.organisation} onChange={(e) => set('organisation', e.target.value)} /></label>
          <label className="field">Mobile number<input className="input" type="tel" placeholder="10-digit number" value={form.mobile} onChange={(e) => set('mobile', e.target.value)} autoComplete="tel" /></label>
          <label className="field">City<input className="input" value={form.city} onChange={(e) => set('city', e.target.value)} /></label>
          <label className="field">Email<input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" /></label>
        </div>
        <div className="row"><button className="btn btn-primary" type="submit">Save profile</button></div>
      </form>

      <section className="card">
        <h2>Plan</h2>
        <div className="row">
          <span className="pill pill-green">Free</span>
          <span>Unlimited auctions, teams and players.</span>
        </div>
      </section>

      <section className="card">
        <h2>Your data</h2>
        <p className="hint" style={{ fontSize: 14 }}>
          Right now your {auctions.length} auction{auctions.length === 1 ? ' is' : 's are'} saved in this browser on this device.
          Download a backup before clearing browser data or moving to another computer. Online login and sync are coming soon.
        </p>
        <div className="row">
          <button className="btn" onClick={download}>Download backup of all auctions</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>Restore from backup</button>
          <input ref={fileRef} type="file" accept=".json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = ''; }} />
        </div>
      </section>
      <Toast msg={toast} />
    </main>
  );
}
