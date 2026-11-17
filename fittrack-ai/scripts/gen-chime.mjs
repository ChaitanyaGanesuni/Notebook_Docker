// Generates assets/sounds/chime.wav: two soft rising tones. Made here, so no third-party audio ships.
import fs from 'node:fs';
const rate = 22050;
const tone = (f, ms, gain) => Array.from({ length: Math.round((rate * ms) / 1000) }, (_, i) => {
  const t = i / rate; const len = ms / 1000;
  const env = Math.min(1, t / 0.01) * Math.exp(-4.5 * (t / len));
  return gain * env * (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * 2 * f * t));
});
const silence = (ms) => new Array(Math.round((rate * ms) / 1000)).fill(0);
const samples = [...tone(880, 180, 0.45), ...silence(60), ...tone(1318.5, 320, 0.45)];
const data = Buffer.alloc(samples.length * 2);
samples.forEach((v, i) => data.writeInt16LE(Math.max(-1, Math.min(1, v)) * 32767 | 0, i * 2));
const h = Buffer.alloc(44);
h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28);
h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
fs.writeFileSync(new URL('../assets/sounds/chime.wav', import.meta.url), Buffer.concat([h, data]));
console.log('wrote chime.wav', data.length + 44, 'bytes');
