import { useRef, useState } from 'react';
import { Toast, useToast } from '../components/ui';
import { exportAccount, importAccount, updateIndex, uploadLocalAuctions, useCloudInfo, useIndex, type AccountBackup } from '../store/store';
import type { Organizer } from '../types';

export function Account() {
  const { organizer, auctions } = useIndex();
  const [form, setForm] = useState<Organizer>(organizer);
  const [toast, showToast] = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const cloud = useCloudInfo();
  const localOnly = auctions.filter((a) => !cloud.synced.includes(a.id)).length;
  const plural = (n: number) => `${n} auction${n === 1 ? '' : 's'}`;

  const upload = () => {
    const n = uploadLocalAuctions();
    showToast(n ? `Uploading ${plural(n)} to the cloud` : 'Nothing to upload');
  };
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
        {!cloud.enabled ? (
          <p className="hint" style={{ fontSize: 14 }}>
            Your {plural(auctions.length)} {auctions.length === 1 ? 'is' : 'are'} saved in this browser on this device.
            Download a backup before clearing browser data or moving to another computer.
          </p>
        ) : (
          <>
            <div className="row">
              {cloud.status.kind === 'on' ? <span className="pill pill-green">Cloud sync on</span>
                : cloud.status.kind === 'error' ? <span className="pill pill-red">Cloud sync problem</span>
                  : <span className="pill pill-grey">Connecting…</span>}
              <span>{plural(auctions.length - localOnly)} saved in the cloud{localOnly ? `, ${localOnly} only on this device` : ''}.</span>
            </div>
            {cloud.status.kind === 'error' && <div className="banner banner-cream">{cloud.status.message} Your auctions are still safe in this browser.</div>}
            <p className="hint" style={{ fontSize: 14 }}>
              Auctions in the cloud can be watched on any device that has the link, for example the Live screen on a projector laptop.
              Only this browser can change them, because there is no login yet: keep downloading a backup, and do not clear this browser’s data.
            </p>
            {localOnly > 0 && (
              <div className="row">
                <button className="btn btn-primary" onClick={upload}>Upload {plural(localOnly)} to the cloud</button>
              </div>
            )}
          </>
        )}
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
