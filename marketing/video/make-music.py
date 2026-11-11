"""Synthesises the reel's music and sound effects (original, so no copyright claims).

120 BPM, A minor (Am - F - C - G), 30 seconds. Hits are timed to reel.html:
  bid pings 4.5..8.5 | SOLD impact 9.0 | feature pops 12.5, 14, 15.5, 17 |
  wheel ticks 18.5..22 | winner hit 22.0 | chips 24.0..25.2 | end card 26.0
Usage: python make-music.py out.wav
"""
import sys
import numpy as np
from scipy.signal import butter, lfilter
from scipy.io import wavfile

SR = 44100
DUR = 30.0
N = int(SR * DUR)
rng = np.random.default_rng(5)
L = np.zeros(N)
R = np.zeros(N)


def add(sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= N or i < 0:
        return
    sig = sig[: N - i]
    L[i:i + len(sig)] += sig * gain * (1 - max(0, pan))
    R[i:i + len(sig)] += sig * gain * (1 + min(0, pan))


def tt(d):
    return np.arange(int(d * SR)) / SR


def lp(x, f):
    b, a = butter(2, f / (SR / 2), 'low')
    return lfilter(b, a, x)


def hp(x, f):
    b, a = butter(2, f / (SR / 2), 'high')
    return lfilter(b, a, x)


def bp(x, lo, hi):
    b, a = butter(2, [lo / (SR / 2), hi / (SR / 2)], 'band')
    return lfilter(b, a, x)


def kick():
    t = tt(0.35)
    f = 48 + 120 * np.exp(-t * 32)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8.5)
    y += 0.25 * np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 300)
    return y


def clap():
    t = tt(0.28)
    n = bp(rng.standard_normal(len(t)), 900, 5500)
    env = np.exp(-t * 17) + 0.6 * np.exp(-((t - 0.012) ** 2) * 9000)
    return n * env * 0.8


def snare():
    t = tt(0.2)
    return (bp(rng.standard_normal(len(t)), 1200, 7000) * np.exp(-t * 24) + 0.4 * np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30))


def hat(open_=False):
    t = tt(0.22 if open_ else 0.06)
    return hp(rng.standard_normal(len(t)), 7500) * np.exp(-t * (18 if open_ else 70)) * 0.5


def tone(freq, d, kind='tri', decay=6.0, attack=0.004):
    t = tt(d)
    ph = 2 * np.pi * freq * t
    if kind == 'saw':
        y = 2 * ((freq * t) % 1) - 1
    elif kind == 'sq':
        y = np.sign(np.sin(ph)) * 0.6
    elif kind == 'sin':
        y = np.sin(ph)
    else:
        y = 2 * np.abs(2 * ((freq * t) % 1) - 1) - 1
    return y * np.exp(-t * decay) * np.minimum(1, t / attack)


def pad(freqs, d):
    t = tt(d)
    y = np.zeros_like(t)
    for f in freqs:
        for det in (-0.004, 0.0, 0.004):
            y += (2 * ((f * (1 + det) * t) % 1) - 1)
    y = lp(y, 1400) / (len(freqs) * 3)
    env = np.minimum(1, t / 0.5) * np.minimum(1, (d - t) / 0.4)
    return y * env


def whoosh(d=0.9):
    t = tt(d)
    n = rng.standard_normal(len(t))
    y = bp(n, 500, 6000)
    env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    return y * env


def riser(d):
    t = tt(d)
    n = hp(rng.standard_normal(len(t)), 2500) * (t / d) ** 2
    f = 220 * (2 ** (3.2 * t / d))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * (t / d) ** 1.5 * 0.35
    return n * 0.45 + s


def impact():
    t = tt(2.2)
    f = 70 * np.exp(-t * 1.2) + 28
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    crash = hp(rng.standard_normal(len(t)), 4000) * np.exp(-t * 2.4) * 0.5
    knock = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 28) * 0.6 + lp(rng.standard_normal(len(t)), 900) * np.exp(-t * 40) * 0.8
    return boom * 1.1 + crash + knock


def tick():
    t = tt(0.05)
    return (np.sin(2 * np.pi * 2100 * t) * 0.6 + hp(rng.standard_normal(len(t)), 3000) * 0.4) * np.exp(-t * 110)


BEAT = 0.5
CH = [  # chord tones, bass root
    ([220.0, 261.63, 329.63], 110.0),    # Am
    ([174.61, 220.0, 261.63], 87.31),    # F
    ([261.63, 329.63, 392.0], 130.81),   # C
    ([196.0, 246.94, 293.66], 98.0),     # G
]


def chord_at(t):
    return CH[int(t // 2) % 4]


# ---------- pads (whole track) ----------
for bar in range(15):
    notes, root = CH[bar % 4]
    g = 0.5 if bar >= 1 else 0.35
    add(pad(notes + [root * 2], 2.1), bar * 2.0, g * (0.7 if 4 <= bar < 9 else 1.0), pan=0.0)

# ---------- groove ----------
def on(t, a, b):
    return a <= t < b

K = kick()
for k in range(0, 60):
    t = k * BEAT
    # kick: from 2.0, drop at 8.5-9.0 (pre-impact gap), light during the wheel tension, sparse in the outro
    if t < 2.0 or on(t, 8.5, 9.0) or on(t, 21.75, 22.0) or t >= 28.0:
        continue
    g = 0.95
    if on(t, 2.0, 3.0):
        g = 0.5
    add(K, t, g)

for k in range(0, 60):
    t = k * BEAT
    if k % 2 == 1 and (on(t, 3.0, 8.0) or on(t, 9.0, 18.0) or on(t, 22.0, 28.0)):
        add(clap(), t, 0.5)
    # offbeat hats
    th = t + BEAT / 2
    if on(th, 4.0, 8.5) or on(th, 9.0, 21.75) or on(th, 22.0, 28.0):
        add(hat(open_=(k % 4 == 3)), th, 0.55, pan=0.2)
    # 16th shaker during the features section
    if on(t, 12.0, 18.0):
        for j in range(4):
            add(hat(), t + j * BEAT / 4, 0.18, pan=-0.3)

# bass: offbeat 8ths
for k in range(0, 120):
    t = k * BEAT / 2
    if not (on(t, 4.0, 8.5) or on(t, 9.0, 21.75) or on(t, 22.0, 28.5)):
        continue
    notes, root = chord_at(t)
    if k % 2 == 1 or (k % 4 == 0 and t >= 9.0):
        add(tone(root, 0.24, 'saw', decay=9), t, 0.34 if k % 2 == 1 else 0.28)
        add(tone(root, 0.24, 'sin', decay=8), t, 0.30)

# arp: 8th notes over chord tones
for k in range(0, 120):
    t = k * BEAT / 2
    if not (on(t, 8.0, 8.5) or on(t, 9.0, 18.0) or on(t, 22.0, 29.0)) and not on(t, 4.0, 8.0):
        continue
    notes, root = chord_at(t)
    pat = [notes[0], notes[1], notes[2], notes[1] * 2, notes[2], notes[1], notes[0] * 2, notes[2]]
    f = pat[k % 8]
    g = 0.11 if on(t, 4.0, 8.0) else (0.2 if on(t, 18.0, 22.0) else 0.19)
    add(tone(f * 2, 0.3, 'tri', decay=7), t, g, pan=-0.35 if k % 2 else 0.35)
    if on(t, 9.0, 12.0) or on(t, 22.0, 26.0):
        add(tone(f * 4, 0.2, 'sq', decay=14), t + 0.0, 0.05, pan=0.5 if k % 2 else -0.5)

# ---------- build-ups and hits ----------
add(riser(2.8), 0.2, 0.28)                 # opening swell into the first whoosh
add(whoosh(0.8), 2.45, 0.5)
add(whoosh(0.9), 3.0 - 0.35, 0.35)
for i, t in enumerate(np.arange(8.0, 9.0, 0.125 if False else 0.0625)):    # snare roll
    add(snare(), t, 0.1 + 0.5 * ((t - 8.0) / 1.0))
add(riser(1.0), 8.0, 0.4)
add(impact(), 9.0, 0.95)                    # SOLD
add(whoosh(0.8), 11.55, 0.45)               # into features
add(whoosh(0.8), 17.55, 0.45)               # into the wheel
add(riser(1.0), 21.0, 0.4)
add(impact(), 22.0, 0.8)                    # winner
add(whoosh(0.8), 23.6, 0.45)                # into chips
add(whoosh(0.9), 25.55, 0.5)                # into end card
add(impact(), 26.0, 0.85)                   # end card

# bid pings
for f, t in zip([880.0, 988.0, 1109.0, 1319.0, 1568.0], [4.5, 5.5, 6.5, 7.5, 8.5]):
    add(tone(f, 0.5, 'sin', decay=7), t, 0.32, pan=0.25)
    add(tone(f * 2, 0.3, 'sin', decay=12), t, 0.12, pan=0.25)

# feature pops (chime) and chip pops
for f, t in zip([1175.0, 1319.0, 1480.0, 1760.0], [12.5, 14.0, 15.5, 17.0]):
    add(tone(f, 0.7, 'sin', decay=5), t, 0.3, pan=-0.2)
    add(tone(f * 1.5, 0.5, 'sin', decay=8), t, 0.12, pan=-0.2)
for f, t in zip([1319.0, 1480.0, 1760.0, 1976.0], [24.0, 24.4, 24.8, 25.2]):
    add(tone(f, 0.35, 'sin', decay=9), t, 0.28)

# wheel ticks follow the wheel's real angle (same easing as reel.html)
T0, T1 = 18.5, 22.0
ts = np.arange(T0, T1, 0.001)
x = np.clip((ts - T0) / (T1 - T0), 0, 1)
ang = (1 - (1 - x) ** 4) * (135 + 360 * 5)
last = 0
for t, a in zip(ts, ang):
    seg = int(a // 45)
    if seg != last:
        last = seg
        add(tick(), t, 0.3)

# ---------- master ----------
mix = np.stack([L, R], axis=1)
fade_in = np.minimum(1, np.arange(N) / (SR * 0.15))
fade_out = np.minimum(1, (N - np.arange(N)) / (SR * 1.2))
mix *= (fade_in * fade_out)[:, None]
mix = np.tanh(mix * 1.15) / np.tanh(1.15)
mix *= 0.89 / max(1e-9, np.abs(mix).max())
out = sys.argv[1] if len(sys.argv) > 1 else 'music.wav'
wavfile.write(out, SR, (mix * 32767).astype(np.int16))
print('wrote', out, f'{N / SR:.1f}s', 'peak', round(float(np.abs(mix).max()), 2))
