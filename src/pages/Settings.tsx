import { Database, Gavel, Info, Layers, MonitorPlay, Plus, SlidersHorizontal, Trash2, Wallet } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SponsorsEditor } from '../components/SponsorsEditor';
import { OptionRow, Segmented, Switch, Tabs, Toast, useToast } from '../components/ui';
import { createDummyState } from '../data/dummy';
import { SPORTS } from '../data/sports';
import { resetAuction } from '../lib/auction';
import { money, uid } from '../lib/format';
import { replaceState, update, useAppState } from '../store/store';
import type { AppState, Settings as SettingsT } from '../types';

type Tab = 'general' | 'squad' | 'categories' | 'bidding' | 'screen' | 'options' | 'data';

function NumInput({ value, onChange, step = 0.05, label, small, placeholder = 'No limit' }: { value: number | null; onChange: (v: number | null) => void; step?: number; label: string; small?: boolean; placeholder?: string }) {
  return (
    <input
      className={'input' + (small ? ' input-sm' : '')}
      type="number"
      inputMode="decimal"
      min={0}
      step={step}
      aria-label={label}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    />
  );
}

function Section({ title, text, children }: { title: string; text: ReactNode; children: ReactNode }) {
  return (
    <section className="set-section">
      <header>
        <h3>{title}</h3>
        <p>{text}</p>
      </header>
      <div className="set-body">{children}</div>
    </section>
  );
}

export function Settings() {
  const state = useAppState();
  const { settings, categories } = state;
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'general';
  const [toast, showToast] = useToast();
  const set = <K extends keyof SettingsT>(key: K, value: SettingsT[K]) => update((s) => void (s.settings[key] = value));
  const auctionStarted = state.auction.status !== 'idle';
  const moneyStep = settings.unit === 'pts' ? 50 : 0.05;

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Step 1</div>
          <h1>Details &amp; rules</h1>
          <p>Changes save automatically.</p>
        </div>
      </div>

      {auctionStarted && (
        <div className="banner banner-cream">
          <Info size={18} />
          <span><strong>The auction has started.</strong> Money rule changes only affect bids made from now on.</span>
        </div>
      )}

      <Tabs
        label="Settings sections"
        value={tab}
        onChange={(t) => setParams({ tab: t }, { replace: true })}
        tabs={[
          { value: 'general', label: 'General', icon: <Info size={16} /> },
          { value: 'squad', label: 'Budget & squad', icon: <Wallet size={16} /> },
          { value: 'categories', label: 'Categories', icon: <Layers size={16} /> },
          { value: 'bidding', label: 'Bidding', icon: <Gavel size={16} /> },
          { value: 'screen', label: 'Live screen', icon: <MonitorPlay size={16} /> },
          { value: 'options', label: 'Options', icon: <SlidersHorizontal size={16} /> },
          { value: 'data', label: 'Data', icon: <Database size={16} /> },
        ]}
      />

      <div className="card tab-panel" key={tab} style={{ padding: '8px 28px' }}>
        {tab === 'general' && (
          <>
            <Section title="Tournament" text="Shown on the live screen, registration form and results.">
              <label className="field">
                Tournament name
                <input className="input" value={settings.name} onChange={(e) => set('name', e.target.value)} />
              </label>
              <div className="grid-2">
                <label className="field">
                  Sport
                  <select className="select" value={settings.sport} onChange={(e) => set('sport', e.target.value as SettingsT['sport'])}>
                    {SPORTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
                <label className="field">
                  Venue
                  <input className="input" value={settings.venue} placeholder="Ground / hall" onChange={(e) => set('venue', e.target.value)} />
                </label>
              </div>
              <label className="field">
                Auction date &amp; time
                <input className="input" type="datetime-local" value={settings.date} onChange={(e) => set('date', e.target.value)} />
              </label>
            </Section>
          </>
        )}

        {tab === 'squad' && (
          <>
            <Section title="Money" text="The currency shown everywhere and how much each team can spend.">
              <div className="grid-2">
                <label className="field">
                  Money unit
                  <select className="select" value={settings.unit} onChange={(e) => set('unit', e.target.value as SettingsT['unit'])}>
                    <option value="Cr">₹ Crore (Cr)</option>
                    <option value="L">₹ Lakh (L)</option>
                    <option value="pts">Points</option>
                  </select>
                </label>
                <label className="field">
                  Purse per team
                  <NumInput label="Purse" value={settings.purse} step={settings.unit === 'pts' ? 500 : 0.5} onChange={(v) => set('purse', v ?? 0)} />
                </label>
              </div>
            </Section>
            <Section title="Squad size" text="Teams cannot bid once full, and must keep enough money to reach the minimum.">
              <div className="grid-2">
                <label className="field">
                  Minimum players per team
                  <NumInput label="Min squad" value={settings.minSquad} step={1} onChange={(v) => set('minSquad', v ?? 0)} />
                </label>
                <label className="field">
                  Maximum players per team
                  <NumInput label="Max squad" value={settings.maxSquad} step={1} onChange={(v) => set('maxSquad', v ?? 0)} />
                </label>
              </div>
            </Section>
          </>
        )}

        {tab === 'categories' && (
          <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card-head">
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>Player categories</h3>
                <p className="hint">Group players (Marquee, A, B…) with their own base price, limits per team and an optional maximum price.</p>
              </div>
              <button
                className="btn btn-sm"
                onClick={() =>
                  update((s) =>
                    void s.categories.push({ id: uid('cat'), name: 'New category', color: '#5B6B82', base: categories.at(-1)?.base ?? 0.1, increment: null, minPerTeam: 0, maxPerTeam: 4, maxPrice: null }),
                  )
                }
              >
                <Plus size={15} />Add category
              </button>
            </div>
            <div className="table-wrap" style={{ boxShadow: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Category</th><th>Base price</th><th>Raise by</th><th>Min / team</th><th>Max / team</th><th>Upper limit</th><th>Players</th><th />
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c, i) => {
                    const count = state.players.filter((p) => p.categoryId === c.id).length;
                    const setCat = (fn: (cat: typeof c) => void) => update((s) => fn(s.categories[i]!));
                    return (
                      <tr key={c.id}>
                        <td>
                          <span className="row" style={{ flexWrap: 'nowrap', gap: 8 }}>
                            <input type="color" aria-label="Category colour" value={c.color} onChange={(e) => setCat((x) => void (x.color = e.target.value))} style={{ width: 28, height: 28, border: 'none', background: 'none', padding: 0 }} />
                            <input className="input input-sm" style={{ minWidth: 130 }} aria-label="Category name" value={c.name} onChange={(e) => setCat((x) => void (x.name = e.target.value))} />
                          </span>
                        </td>
                        <td><NumInput small label="Base price" step={moneyStep} value={c.base} onChange={(v) => setCat((x) => void (x.base = v ?? 0))} /></td>
                        <td><NumInput small label="Raise by" step={moneyStep} placeholder="Default" value={c.increment} onChange={(v) => setCat((x) => void (x.increment = v))} /></td>
                        <td><NumInput small label="Min per team" step={1} value={c.minPerTeam} onChange={(v) => setCat((x) => void (x.minPerTeam = v ?? 0))} /></td>
                        <td><NumInput small label="Max per team" step={1} value={c.maxPerTeam} onChange={(v) => setCat((x) => void (x.maxPerTeam = v ?? 99))} /></td>
                        <td><NumInput small label="Upper limit" step={moneyStep} placeholder={settings.maxPlayerPrice != null ? 'Auction: ' + settings.maxPlayerPrice : 'No limit'} value={c.maxPrice} onChange={(v) => setCat((x) => void (x.maxPrice = v))} /></td>
                        <td className="num"><span className="pill pill-grey">{count}</span></td>
                        <td>
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            disabled={count > 0 || categories.length === 1}
                            title={count > 0 ? 'Move its players to another category first' : 'Delete category'}
                            aria-label={'Delete ' + c.name}
                            onClick={() => update((s) => void s.categories.splice(i, 1))}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="hint">"Raise by" empty = use the bid increments from the Bidding tab. "Upper limit" empty = use the auction’s upper limit (Bidding tab).</p>
          </div>
        )}

        {tab === 'bidding' && (
          <>
            <Section title="Bid increments" text="How much each new bid goes up by, depending on the current price.">
              <div className="table-wrap" style={{ boxShadow: 'none' }}>
                <table className="table">
                  <thead><tr><th>When the bid is below</th><th>Raise by</th><th /></tr></thead>
                  <tbody>
                    {settings.slabs.map((slab, i) => (
                      <tr key={i}>
                        <td>
                          {slab.upTo == null ? <span className="muted">Any higher amount</span> : (
                            <NumInput small label="Below" step={moneyStep} value={slab.upTo} onChange={(v) => update((s) => void (s.settings.slabs[i]!.upTo = v ?? 0))} />
                          )}
                        </td>
                        <td><NumInput small label="Raise by" step={moneyStep} value={slab.step} onChange={(v) => update((s) => void (s.settings.slabs[i]!.step = v ?? moneyStep))} /></td>
                        <td>
                          {slab.upTo != null && (
                            <button className="btn btn-ghost btn-sm btn-icon" aria-label="Remove row" onClick={() => update((s) => void s.settings.slabs.splice(i, 1))}><Trash2 size={15} /></button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="btn btn-sm"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => update((s) => void s.settings.slabs.splice(-1, 0, { upTo: (s.settings.slabs.at(-2)?.upTo ?? 0) + (settings.unit === 'pts' ? 1000 : 1), step: s.settings.slabs.at(-1)!.step }))}
              >
                <Plus size={15} />Add price range
              </button>
            </Section>
            <Section
              title="Upper limit & lucky draw"
              text="The most any one player can go for. When bidding reaches it, nobody can go higher — the teams that still want him go into a lucky draw."
            >
              <label className="field">
                Upper limit per player
                <NumInput label="Upper limit per player" step={moneyStep} placeholder="No limit" value={settings.maxPlayerPrice} onChange={(v) => set('maxPlayerPrice', v)} />
                <span className="hint">
                  Leave empty for no limit. A category can have its own limit in the{' '}
                  <button type="button" className="btn-ghost" style={{ border: 'none', background: 'none', padding: 0, color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }} onClick={() => setParams({ tab: 'categories' }, { replace: true })}>
                    Categories tab
                  </button>
                  , which is used instead of this one.
                </span>
              </label>
              {categories.some((c) => c.maxPrice != null) && (
                <p className="hint">
                  Category limits: {categories.filter((c) => c.maxPrice != null).map((c) => `${c.name} ${money(c.maxPrice, settings.unit)}`).join(' · ')}
                </p>
              )}
              <OptionRow title="Lucky draw at the upper limit" control={<Switch label="Lucky draw" checked={settings.tieDraw} onChange={(v) => set('tieDraw', v)} />}>
                On: at the limit, other teams can say “we want him at this price” and SOLD runs a lucky draw.
                Off: the team that reached the limit first gets the player.
              </OptionRow>
              {settings.tieDraw && (
                <div className="field">
                  Who can join the draw
                  <Segmented
                    label="Who can join the draw"
                    value={settings.drawEntry}
                    onChange={(v) => set('drawEntry', v)}
                    options={[
                      { value: 'bidders', label: 'Only teams that bid on him' },
                      { value: 'any', label: 'Any team that can afford' },
                    ]}
                  />
                  <span className="hint">The winner pays the upper limit price.</span>
                </div>
              )}
            </Section>
            <Section title="Bid timer" text="Auto starts a countdown for each player and resets it after every bid. Manual lets you start it yourself.">
              <Segmented
                label="Timer mode"
                value={settings.timerMode}
                onChange={(v) => set('timerMode', v)}
                options={[
                  { value: 'off', label: 'Off' },
                  { value: 'auto', label: 'Auto' },
                  { value: 'manual', label: 'Manual' },
                ]}
              />
              {settings.timerMode !== 'off' && (
                <div className="grid-2">
                  <label className="field">
                    First countdown (seconds)
                    <NumInput label="Timer start" value={settings.timerStart} step={5} onChange={(v) => set('timerStart', v ?? 30)} />
                  </label>
                  <label className="field">
                    After each bid (seconds)
                    <NumInput label="Timer after bid" value={settings.timerAfterBid} step={5} onChange={(v) => set('timerAfterBid', v ?? 15)} />
                  </label>
                </div>
              )}
            </Section>
          </>
        )}

        {tab === 'screen' && (
          <>
            <Section title="Look" text="How the projector / TV screen looks for the audience.">
              <div className="grid-2">
                <label className="field">
                  Theme
                  <select className="select" value={settings.theme} onChange={(e) => set('theme', e.target.value as SettingsT['theme'])}>
                    <option value="stadium">Night Stadium (dark blue)</option>
                    <option value="gold">Gold Rush (dark gold)</option>
                    <option value="light">Daylight (light)</option>
                  </select>
                </label>
                <label className="field">
                  Sold effect
                  <select className="select" value={settings.soldEffect} onChange={(e) => set('soldEffect', e.target.value as SettingsT['soldEffect'])}>
                    <option value="fireworks">Gold sparks</option>
                    <option value="confetti">Foil confetti</option>
                    <option value="stamp">SOLD stamp only</option>
                    <option value="none">None (no full-screen SOLD)</option>
                  </select>
                </label>
              </div>
            </Section>
            <Section title="Sponsors" text="Shown on the live screen, the streaming overlay and the pictures you share on WhatsApp. Add a logo, or just the name.">
              <SponsorsEditor sponsors={state.sponsors ?? []} />
            </Section>
            <Section title="Sound" text="Played on the live screen after you click “Turn on sound” there.">
              <OptionRow title="Sound effects" control={<Switch label="Sound" checked={settings.sound} onChange={(v) => set('sound', v)} />}>
                Gavel on SOLD, a beep on each bid and a tick in the last 5 seconds.
              </OptionRow>
            </Section>
          </>
        )}

        {tab === 'options' && (
          <>
            <Section title="Player order" text="Which player comes up next on auction day.">
              <Segmented
                label="Player order"
                value={settings.order}
                onChange={(v) => set('order', v)}
                options={[
                  { value: 'category', label: 'By category' },
                  { value: 'random', label: 'Random' },
                  { value: 'manual', label: 'I pick' },
                ]}
              />
              <p className="hint">
                {settings.order === 'category'
                  ? categories.map((c) => c.name).join(' → ') + ', shuffled inside each category.'
                  : settings.order === 'random' ? 'All players in one shuffled list.' : 'You choose each player from a list in the console.'}
              </p>
            </Section>
            <Section title="Auction rules" text="Turn features on or off for this tournament.">
              <div>
                <OptionRow title="Re-auction unsold players" control={<Switch label="Re-auction" checked={settings.reauction} onChange={(v) => set('reauction', v)} />}>
                  Unsold players come back in round 2.
                </OptionRow>
                <OptionRow title="Reserve purse check" control={<Switch label="Reserve check" checked={settings.reserveCheck} onChange={(v) => set('reserveCheck', v)} />}>
                  Block a bid if the team could not afford its minimum squad afterwards.
                </OptionRow>
                <OptionRow title="Retained players" control={<Switch label="Retention" checked={settings.retention} onChange={(v) => set('retention', v)} />}>
                  Teams keep up to {settings.maxRetained} players before the auction; the price comes out of their purse.
                </OptionRow>
                <OptionRow title="Right to Match (RTM)" control={<Switch label="RTM" checked={settings.rtm} onChange={(v) => set('rtm', v)} />}>
                  A player’s last-season team can match the final price to keep him.
                  {settings.rtm && (
                    <span className="row" style={{ marginTop: 8 }}>
                      RTM cards per team
                      <span style={{ width: 80 }}><NumInput small label="RTM cards" value={settings.rtmCards} step={1} onChange={(v) => set('rtmCards', v ?? 0)} /></span>
                    </span>
                  )}
                </OptionRow>
              </div>
            </Section>
            <Section title="Convenience" text="Faster control on auction day and self-service links.">
              <div>
                <OptionRow title="Keyboard shortcuts" control={<Switch label="Keyboard" checked={settings.keyboard} onChange={(v) => set('keyboard', v)} />}>
                  Press a team’s key to bid · S Sold · U Unsold · Z Undo · N Next.
                </OptionRow>
                <OptionRow title="Team owners bid from phone" control={<Switch label="Owner bidding" checked={settings.ownerBidding} onChange={(v) => set('ownerBidding', v)} />}>
                  Owners open the bidding link and tap BID.
                </OptionRow>
                <OptionRow title="Player self-registration" control={<Switch label="Self registration" checked={settings.selfRegistration} onChange={(v) => set('selfRegistration', v)} />}>
                  Players fill a form; they appear in your list “on hold” for review.
                </OptionRow>
              </div>
            </Section>
          </>
        )}

        {tab === 'data' && <DataTab state={state} showToast={showToast} />}
      </div>
      <p className="hint">Total purse across all teams: {money(settings.purse * state.teams.length, settings.unit)}</p>
      <Toast msg={toast} />
    </main>
  );
}

function DataTab({ state, showToast }: { state: AppState; showToast: (m: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { settings } = state;

  const backup = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = settings.name.replace(/[^\w ]+/g, '') + ' - backup.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const restore = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as AppState;
      if (!data.settings || !Array.isArray(data.players)) throw new Error('not a backup');
      replaceState(data);
      showToast('Backup restored');
    } catch {
      showToast('That file is not an auction backup');
    }
  };

  return (
    <>
      <Section title="Backup" text="Save a copy of this auction to a file, or load one back.">
        <div className="row">
          <button className="btn" onClick={backup}>Download backup</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>Restore from file</button>
          <input ref={fileRef} type="file" accept=".json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = ''; }} />
        </div>
      </Section>
      <Section title="Start over" text="Download a backup first if you want to keep the current data.">
        <div className="row">
          <button
            className="btn btn-danger"
            onClick={() => confirm('Clear all sales and start the auction again? Teams, players and retained players stay.') && update(resetAuction)}
          >
            Reset auction results
          </button>
          <button
            className="btn btn-danger"
            onClick={() =>
              confirm('Replace the teams and players of this auction with test data (8 teams, 96 players)?') &&
              replaceState(createDummyState(settings.sport, { name: settings.name, date: settings.date, venue: settings.venue, unit: settings.unit, purse: settings.purse }))
            }
          >
            Load test data
          </button>
        </div>
      </Section>
    </>
  );
}
