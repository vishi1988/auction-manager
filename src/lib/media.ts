/**
 * Prepares an uploaded photo: at most `size` pixels on its longest side, as a
 * JPEG of at most `maxBytes` (as a data: URL). Sharp enough for a projector,
 * small enough to share with phones. Quality only drops when a photo would be too big.
 */
export function resizeImage(file: File, size = 800, background?: string, maxBytes = 190_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      let side = size;
      for (;;) {
        const scale = Math.min(1, side / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const g = canvas.getContext('2d')!;
        g.imageSmoothingQuality = 'high';
        if (background) {
          // Logos with a see-through background would turn black as a JPEG.
          g.fillStyle = background;
          g.fillRect(0, 0, canvas.width, canvas.height);
        }
        g.drawImage(img, 0, 0, canvas.width, canvas.height);
        for (const q of [0.9, 0.85, 0.8, 0.72]) {
          const url = canvas.toDataURL('image/jpeg', q);
          if (url.length <= maxBytes) return resolve(url);
        }
        // Still too big (a very detailed photo): try a little smaller.
        if (side <= 320) return resolve(canvas.toDataURL('image/jpeg', 0.65));
        side = Math.round(side * 0.8);
      }
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

let ctx: AudioContext | null = null;

function tone(freq: number, start: number, duration: number, type: OscillatorType, volume: number) {
  ctx ??= new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
  gain.gain.setValueAtTime(volume, ctx.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + duration);
}

/** Small synthesized sounds, so no audio files are needed. */
export const sounds = {
  gavel() {
    tone(140, 0, 0.18, 'square', 0.25);
    tone(110, 0.22, 0.25, 'square', 0.3);
  },
  bid() {
    tone(880, 0, 0.08, 'sine', 0.15);
  },
  tick() {
    tone(1200, 0, 0.04, 'sine', 0.08);
  },
  unsold() {
    tone(330, 0, 0.2, 'triangle', 0.2);
    tone(220, 0.2, 0.3, 'triangle', 0.2);
  },
};
