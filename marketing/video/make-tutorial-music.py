"""A calm, original background bed for the tutorial (soft pads + a gentle pluck). Usage: python make-tutorial-music.py out.wav [seconds]"""
import sys
import numpy as np
from scipy.signal import butter, lfilter
from scipy.io import wavfile

SR = 44100
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 240.0
N = int(SR * DUR)
L = np.zeros(N)
R = np.zeros(N)


def lp(x, f):
    b, a = butter(2, f / (SR / 2), 'low')
    return lfilter(b, a, x)


def pad(freqs, d):
    t = np.arange(int(d * SR)) / SR
    y = np.zeros_like(t)
    for f in freqs:
        for det in (-0.003, 0.0, 0.003):
            y += 2 * ((f * (1 + det) * t) % 1) - 1
    y = lp(y, 1100) / (len(freqs) * 3)
    env = np.minimum(1, t / 1.6) * np.minimum(1, (d - t) / 1.6)
    return y * env


def pluck(f, d=0.9):
    t = np.arange(int(d * SR)) / SR
    return np.sin(2 * np.pi * f * t) * np.exp(-t * 4.5) * np.minimum(1, t / 0.005)


def add(sig, t0, g, pan=0.0):
    i = int(t0 * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    L[i:i + len(sig)] += sig * g * (1 - max(0, pan))
    R[i:i + len(sig)] += sig * g * (1 + min(0, pan))


CH = [  # Am - F - C - G, 4 s each (60 BPM feel)
    [220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [261.63, 329.63, 392.0], [196.0, 246.94, 293.66],
]
bar = 4.0
for k in range(int(DUR // bar) + 1):
    notes = CH[k % 4]
    add(pad(notes + [notes[0] / 2], bar + 1.2), k * bar, 0.55)
    for j, f in enumerate([notes[0] * 2, notes[1] * 2, notes[2] * 2, notes[1] * 2, notes[2] * 4, notes[1] * 2, notes[0] * 4, notes[2] * 2]):
        add(pluck(f), k * bar + j * 0.5, 0.16, pan=-0.3 if j % 2 else 0.3)

mix = np.stack([L, R], axis=1)
mix *= np.minimum(1, np.arange(N) / (SR * 2.0))[:, None]
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix *= 0.8 / max(1e-9, np.abs(mix).max())
wavfile.write(sys.argv[1], SR, (mix * 32767).astype(np.int16))
print('wrote', sys.argv[1])
