#!/usr/bin/env python3
"""Klang-Generator für Wrack Ikarus.

Erzeugt alle Soundeffekte und die Musik synthetisch (numpy/scipy) und schreibt sie als
MP3 nach public/assets/audio/, dazu manifest.json mit den Loop-Längen.
MP3, weil es jeder Browser dekodiert. Loop-Längen sind Vielfache von 1152 Samples (ein MP3-Block),
dann sind Loop-Anfang und -Ende identisch kodiert und die Schleife ist nahtlos.
Alles ist deterministisch (fester Seed): Gleicher Code ergibt gleiche Dateien.

Aufruf (im Projektordner):  python3 scripts/audio/generate.py
Braucht: numpy, scipy, ffmpeg (mit libmp3lame).

Musik: alles in A, damit die Kampfspur zu jedem Deck passt.
  amb_fracht   Frachtdeck: kaltes Brummen, Wind, ferne Metallklänge
  amb_wohn     Wohnbereich: unheimliche Spieluhr, Knarzen, Halbtonreibung
  amb_reaktor  Reaktorring: Maschinenpuls, Dampf, industrielles Summen
  amb_brut     Brutkammer: Herzschlag, organisches Gurgeln, Tritonus
  kampf        Kampfspur (90 BPM, 12 Takte = 32 s), wird je nach Lage dazugemischt
  kampf_boss   härtere Kampfspur für die Brutmutter
"""
import json
import os
import subprocess
import sys
import tempfile
import wave

import numpy as np
from scipy import signal

SR = 44100
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'public', 'assets', 'audio')
rng = np.random.default_rng(4242)

# Beim Rendern eines Loops (Länge LOOP Sekunden): Frequenzen auf ganze Schwingungen pro Loop runden
# und Filter auf loop-lange Signale zyklisch anwenden, damit die Schleifenstelle nicht knackt.
LOOP = None


def qf(f):
    return round(f * LOOP) / LOOP if (LOOP and np.ndim(f) == 0) else f


def is_loop(x):
    return LOOP is not None and len(x) == int(LOOP * SR)


# ---------------------------------------------------------------- Grundbausteine
def tt(dur):
    return np.arange(int(dur * SR)) / SR


def silence(dur):
    return np.zeros(int(dur * SR))


def env(n, a=0.005, d=0.1, s=0.0, r=0.1, hold=0.0):
    """ADSR-Hüllkurve mit n Samples (Zeiten in Sekunden)."""
    a_, d_, h_, r_ = (int(x * SR) for x in (a, d, hold, r))
    e = np.concatenate([
        np.linspace(0, 1, max(a_, 1), endpoint=False),
        np.linspace(1, s, max(d_, 1), endpoint=False),
        np.full(max(h_, 0), s),
        np.linspace(s, 0, max(r_, 1)),
    ])
    if len(e) < n:
        e = np.concatenate([e, np.zeros(n - len(e))])
    return e[:n]


def expdec(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def phase_of(freq):
    """Phase für eine (evtl. zeitabhängige) Frequenz."""
    f = np.broadcast_to(freq, freq.shape if np.ndim(freq) else (1,))
    return 2 * np.pi * np.cumsum(f) / SR


def sine(freq, n=None):
    freq = qf(freq)
    if np.ndim(freq) == 0:
        return np.sin(2 * np.pi * freq * np.arange(n) / SR)
    return np.sin(phase_of(freq))


def saw(freq, n=None):
    freq = qf(freq)
    ph = (freq * np.arange(n) / SR) if np.ndim(freq) == 0 else np.cumsum(freq) / SR
    return 2 * (ph % 1.0) - 1


def square(freq, n=None, duty=0.5):
    freq = qf(freq)
    ph = (freq * np.arange(n) / SR) if np.ndim(freq) == 0 else np.cumsum(freq) / SR
    return np.where((ph % 1.0) < duty, 1.0, -1.0)


def tri(freq, n=None):
    return 2 * np.abs(saw(freq, n)) - 1


def noise(n):
    return rng.uniform(-1, 1, n)


def pink(n):
    w = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n)
    f[0] = f[1]
    p = np.fft.irfft(w / np.sqrt(f), n)
    return p / (np.max(np.abs(p)) + 1e-9)


def filt(x, kind, freq, order=2, q=None):
    nyq = SR / 2
    if kind == 'band':
        lo, hi = freq
        sos = signal.butter(order, [max(lo, 10) / nyq, min(hi, nyq * 0.95) / nyq], 'bandpass', output='sos')
    else:
        sos = signal.butter(order, min(freq, nyq * 0.95) / nyq, kind, output='sos')
    if is_loop(x):  # zyklisch: mit dem Ende des Loops einschwingen
        w = int(2 * SR)
        return signal.sosfilt(sos, np.concatenate([x[-w:], x]))[w:]
    return signal.sosfilt(sos, x)


def sweep(x, kind, cut, block=1024, order=2):
    """Zeitvariabler Filter: cut ist ein Array (Hz) gleicher Länge wie x."""
    if is_loop(x):  # zyklisch: mit dem Ende des Loops einschwingen
        w = int(2 * SR)
        global LOOP
        keep, LOOP = LOOP, None
        y = sweep(np.concatenate([x[-w:], x]), kind, np.concatenate([cut[-w:], cut]), block, order)[w:]
        LOOP = keep
        return y
    out = np.zeros_like(x)
    zi = None
    nyq = SR / 2
    for i in range(0, len(x), block):
        c = float(np.clip(cut[min(i + block // 2, len(cut) - 1)], 30, nyq * 0.9))
        sos = signal.butter(order, c / nyq, kind, output='sos')
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        out[i:i + block], zi = signal.sosfilt(sos, x[i:i + block], zi=zi)
    return out


def bell(freq, dur, decay=1.5, ratios=(1, 2.76, 5.4, 8.93), amps=(1, .5, .25, .12)):
    n = int(dur * SR)
    out = np.zeros(n)
    for r, a in zip(ratios, amps):
        out += a * sine(freq * r, n) * expdec(n, decay / (1 + r * .35))
    return out * env(n, a=.002, d=0, s=1, r=.05, hold=dur)


def pan(x, p):
    """p von -1 (links) bis 1 (rechts), gleiche Lautheit."""
    ang = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(ang), x * np.sin(ang)])


def stereo(x):
    return np.stack([x, x]) if x.ndim == 1 else x


def place(buf, x, at):
    """Klang x (Stereo) ab Sekunde at in buf mischen, am Ende umbrechen (für Loops)."""
    x = stereo(x)
    i = int(at * SR) % buf.shape[1]
    n = x.shape[1]
    end = min(i + n, buf.shape[1])
    buf[:, i:end] += x[:, :end - i]
    if i + n > buf.shape[1]:
        rest = i + n - buf.shape[1]
        buf[:, :rest] += x[:, n - rest:]


_ir_cache = {}


def reverb(x, size=2.5, mix=0.3, pre=0.02, damp=4000, seed=0):
    """Faltungshall mit künstlicher Impulsantwort (Stereo, dekorreliert)."""
    key = (size, pre, damp, seed)
    if key not in _ir_cache:
        r = np.random.default_rng(1000 + seed)
        n = int(size * SR)
        irs = []
        for _ in range(2):
            ir = r.standard_normal(n) * np.exp(-np.arange(n) / (size * SR / 6.9))
            ir = filt(ir, 'low', damp)
            ir = np.concatenate([np.zeros(int(pre * SR)), ir])
            irs.append(ir / np.sqrt(np.sum(ir ** 2)))
        _ir_cache[key] = irs
    irs = _ir_cache[key]
    x = stereo(x)
    wet = np.stack([signal.fftconvolve(x[c], irs[c])[:x.shape[1]] for c in range(2)])
    return x * (1 - mix) + wet * mix


def loop_reverb(buf, **kw):
    """Hall für Loops: Ende des Halls wird an den Anfang gefaltet, damit die Naht nicht auffällt."""
    n = buf.shape[1]
    tail = int(kw.get('size', 2.5) * SR) + int(kw.get('pre', 0.02) * SR)
    ext = np.concatenate([buf, buf[:, :tail]], axis=1)
    pad = np.concatenate([buf[:, -tail:], ext], axis=1)
    wet = reverb(pad, **kw)
    return wet[:, tail:tail + n]


def soft(x, drive=1.5):
    return np.tanh(x * drive) / np.tanh(drive)


def norm_peak(x, db=-1.0):
    return x / (np.max(np.abs(x)) + 1e-9) * 10 ** (db / 20)


def norm_rms(x, db=-20.0, peak_db=-1.0):
    rms = np.sqrt(np.mean(x ** 2)) + 1e-9
    y = x * (10 ** (db / 20) / rms)
    pk = np.max(np.abs(y))
    lim = 10 ** (peak_db / 20)
    if pk > lim:
        y = soft(y / pk * 1.2, 1.2) * lim
    return y


def fade(x, fin=0.003, fout=0.02):
    x = stereo(x).copy()
    n = x.shape[1]
    a, b = int(fin * SR), int(fout * SR)
    if a:
        x[:, :a] *= np.linspace(0, 1, a)
    if b:
        x[:, n - b:] *= np.linspace(1, 0, b)
    return x


def hz(note):
    """Notenname wie 'A2', 'C#3', 'Eb4' in Hz."""
    names = {'C': -9, 'D': -7, 'E': -5, 'F': -4, 'G': -2, 'A': 0, 'B': 2}
    n = names[note[0]]
    rest = note[1:]
    if rest[0] in '#b':
        n += 1 if rest[0] == '#' else -1
        rest = rest[1:]
    return 440 * 2 ** ((n + (int(rest) - 4) * 12) / 12)


# ---------------------------------------------------------------- Soundeffekte
def sfx_shoot():
    n = int(.32 * SR)
    f = 1900 * np.exp(-np.arange(n) / (.045 * SR)) + 260
    x = .55 * square(f, duty=.3) * expdec(n, .07) + .35 * saw(f * 1.01) * expdec(n, .05)
    x = filt(x, 'low', 6000)
    x += .4 * filt(noise(n), 'high', 2500) * expdec(n, .012)
    return reverb(fade(pan(x, .1), 0, .03), size=.8, mix=.18, seed=1)


def sfx_hit():
    n = int(.25 * SR)
    f = 140 * np.exp(-np.arange(n) / (.04 * SR)) + 55
    body = sine(f) * expdec(n, .07)
    crack = filt(noise(n), 'band', (400, 3500)) * expdec(n, .025)
    x = soft(1.1 * body + .9 * crack, 2)
    return reverb(fade(x, 0, .03), size=.6, mix=.12, seed=2)


def sfx_miss():
    n = int(.22 * SR)
    cut = np.linspace(600, 3500, n)
    x = sweep(noise(n), 'low', cut) * env(n, a=.06, d=.15, s=0, r=.01)
    return fade(pan(.8 * x, -.2), .005, .03)


def sfx_hurt():
    n = int(.42 * SR)
    f = 95 * np.exp(-np.arange(n) / (.08 * SR)) + 42
    thud = sine(f) * expdec(n, .1)
    growl = filt(saw(70 + 8 * sine(31, n), n), 'low', 700) * expdec(n, .12)
    clank = bell(820, .42, decay=.25, ratios=(1, 2.4, 3.9, 6.1), amps=(.6, .4, .3, .2))
    x = soft(1.2 * thud + .5 * growl + .35 * clank, 2.2)
    return reverb(fade(x, 0, .05), size=.7, mix=.15, seed=3)


def sfx_zap():
    n = int(.3 * SR)
    f = 950 * np.exp(-np.arange(n) / (.12 * SR)) + 380
    x = saw(f) * (0.6 + 0.4 * square(57, n)) * expdec(n, .09)
    x = filt(x, 'band', (300, 5000))
    x += .3 * filt(noise(n), 'high', 4000) * expdec(n, .02)
    return reverb(fade(pan(x, .25), 0, .03), size=.7, mix=.15, seed=4)


def sfx_spit():
    n = int(.55 * SR)
    am = 0.5 + 0.5 * np.abs(sine(23 + 9 * sine(3, n), n))
    x = filt(noise(n), 'band', (250, 1800)) * am * env(n, a=.02, d=.2, s=.3, r=.3)
    blub = sine(180 * np.exp(-np.arange(n) / (.15 * SR)) + 90) * expdec(n, .12)
    return reverb(fade(.8 * x + .6 * blub, .005, .05), size=1.2, mix=.25, seed=5)


def sfx_pick():
    out = np.zeros((2, int(.45 * SR)))
    for i, note in enumerate(['E5', 'A5']):
        n = int(.3 * SR)
        x = (tri(hz(note), n) * .6 + sine(hz(note) * 2, n) * .25) * expdec(n, .09)
        place(out, pan(x, -.2 + .4 * i), i * .07)
    return reverb(fade(out, 0, .05), size=1.0, mix=.2, seed=6)


def sfx_kill():
    n = int(.6 * SR)
    f = 420 * np.exp(-np.arange(n) / (.15 * SR)) + 45
    x = square(f, duty=.35) * expdec(n, .18)
    x = filt(x, 'low', 2500)
    crunch = filt(noise(n), 'band', (200, 2200)) * expdec(n, .09)
    x = soft(.7 * x + .7 * crunch, 2)
    return reverb(fade(x, 0, .08), size=1.0, mix=.2, seed=7)


def sfx_drop():
    x = bell(1320, .35, decay=.18, ratios=(1, 2.6, 4.1), amps=(.6, .3, .15))
    x += .3 * filt(noise(len(x)), 'high', 3000) * expdec(len(x), .01)
    return reverb(fade(pan(x, -.1), 0, .05), size=.6, mix=.15, seed=8)


def sfx_lvl():
    out = np.zeros((2, int(1.4 * SR)))
    for i, note in enumerate(['A4', 'C5', 'E5', 'A5', 'C6']):
        x = bell(hz(note), .9, decay=.9, ratios=(1, 2, 3.01, 4.2), amps=(1, .35, .15, .08))
        place(out, pan(.55 * x, -.4 + .2 * i), i * .085)
    return reverb(fade(out, 0, .2), size=2.0, mix=.3, seed=9)


def sfx_lift():
    n = int(1.1 * SR)
    hiss = filt(noise(n), 'band', (1500, 7000)) * env(n, a=.05, d=.3, s=.4, r=.6)
    motor = filt(saw(48 + 18 * np.linspace(0, 1, n), n), 'low', 400) * env(n, a=.15, d=.2, s=.6, r=.4)
    clunk = np.zeros(n)
    k = int(.85 * SR)
    m = n - k
    clunk[k:] = (sine(70 * np.exp(-np.arange(m) / (.05 * SR)) + 45) + .6 * filt(noise(m), 'low', 900)) * expdec(m, .06)
    x = .35 * hiss + .5 * motor + .9 * clunk
    return reverb(fade(x, .01, .1), size=1.5, mix=.25, seed=10)


def sfx_die():
    n = int(2.2 * SR)
    f = hz('A3') * np.exp(-np.arange(n) / (.9 * SR)) + 30
    drone = filt(saw(f) + saw(f * 1.006), 'low', 1200) * env(n, a=.02, d=.5, s=.5, r=1.6)
    beat = np.zeros((2, n))
    for at, amp in [(0, 1), (.32, .7), (1.05, .55)]:
        m = int(.25 * SR)
        place(beat, .9 * amp * sine(55 * np.exp(-np.arange(m) / (.06 * SR)) + 38) * expdec(m, .08), at)
    x = .45 * stereo(drone) + beat + .15 * stereo(filt(noise(n), 'low', 800) * env(n, a=.4, d=.5, s=.3, r=1.2))
    return reverb(fade(x, 0, .3), size=3.0, mix=.35, seed=11)


def sfx_emp():
    n = int(.9 * SR)
    f = np.linspace(80, 900, n) ** 1.02
    charge = saw(f) * env(n, a=.45, d=.05, s=.0, r=.4) * (0.7 + 0.3 * square(30, n))
    charge = filt(charge, 'band', (100, 6000))
    m = int(.5 * SR)
    pulse = np.zeros(n)
    pulse[n - m:] = (sine(60 * np.exp(-np.arange(m) / (.08 * SR)) + 35) * expdec(m, .15)
                     + .5 * filt(noise(m), 'band', (2000, 8000)) * expdec(m, .05))
    x = .5 * charge + 1.0 * pulse
    return reverb(fade(x, .01, .1), size=1.6, mix=.3, seed=12)


def sfx_boom():
    n = int(1.6 * SR)
    body = sweep(noise(n), 'low', 4000 * np.exp(-np.arange(n) / (.25 * SR)) + 150) * expdec(n, .35)
    sub = sine(85 * np.exp(-np.arange(n) / (.12 * SR)) + 32) * expdec(n, .3)
    crackle = filt(noise(n), 'high', 2500) * (rng.random(n) < 0.004) * expdec(n, .5) * 6
    x = soft(1.1 * body + 1.2 * sub + .4 * crackle, 2.5)
    return reverb(fade(x, 0, .3), size=2.4, mix=.25, seed=13)


def sfx_win():
    out = np.zeros((2, int(3.0 * SR)))
    chord = ['A3', 'E4', 'A4', 'C#5', 'E5']
    for i, note in enumerate(chord):
        n = int(2.6 * SR)
        f = hz(note)
        x = (saw(f, n) + saw(f * 1.004, n)) * .5
        x = filt(x, 'low', 2400) * env(n, a=.6, d=.4, s=.6, r=1.4, hold=.3)
        place(out, pan(.22 * x, -.6 + .3 * i), i * .12)
    for i, note in enumerate(['E5', 'A5', 'C#6', 'E6']):
        place(out, pan(.35 * bell(hz(note), 1.4, decay=1.0), .4 - .25 * i), .2 + i * .18)
    return reverb(fade(out, .02, .5), size=3.0, mix=.35, seed=14)


SFX = {
    'shoot': sfx_shoot, 'hit': sfx_hit, 'miss': sfx_miss, 'hurt': sfx_hurt, 'zap': sfx_zap,
    'spit': sfx_spit, 'pick': sfx_pick, 'kill': sfx_kill, 'drop': sfx_drop, 'lvl': sfx_lvl,
    'lift': sfx_lift, 'die': sfx_die, 'emp': sfx_emp, 'boom': sfx_boom, 'win': sfx_win,
}


# ---------------------------------------------------------------- Musik
def drone(n, notes, cut_lo=180, cut_hi=650, lfo=1 / 32, amp=.25, detune=1.004):
    x = np.zeros(n)
    for note in notes:
        f = hz(note)
        x += saw(f, n) + saw(f * detune, n) + .5 * saw(f / detune, n)
    t = np.arange(n) / SR
    cut = cut_lo + (cut_hi - cut_lo) * (0.5 + 0.5 * np.sin(2 * np.pi * lfo * t))
    return amp * sweep(x / (len(notes) * 2.5), 'low', cut)


def pad(n, chords, seg, amp=.12, cut=1400, voice='tri'):
    out = np.zeros(n)
    osc = tri if voice == 'tri' else saw
    for k, chord in enumerate(chords):
        start = int(k * seg * SR)
        m = int((seg + 6) * SR)
        x = np.zeros(m)
        for note in chord:
            f = hz(note)
            x += osc(f, m) + .7 * osc(f * 1.003, m) + .7 * osc(f * .997, m)
        x = filt(x / len(chord), 'low', cut) * env(m, a=4, d=1, s=.8, r=6, hold=seg - 5)
        end = start + m
        if end <= n:
            out[start:end] += x
        else:
            out[start:] += x[:n - start]
            out[:end - n] += x[n - start:]
    return amp * out


def wind(n, lo=250, hi=1100, amp=.06, period=32):
    t = np.arange(n) / SR
    cut = lo + (hi - lo) * (0.5 + 0.5 * np.sin(2 * np.pi * t / period))
    return amp * sweep(pink(n), 'low', cut)


def amb_fracht(L=64):
    n = int(L * SR)
    buf = np.zeros((2, n))
    buf += stereo(drone(n, ['A1', 'E2'], 160, 620, lfo=1 / 32, amp=.30))
    buf += stereo(.12 * sine(hz('A1'), n) * (0.8 + 0.2 * sine(1 / 8, n)))
    chords = [['A2', 'C3', 'E3'], ['F2', 'A2', 'C3', 'E3'], ['D3', 'F3', 'A3'], ['E2', 'G2', 'B2']]
    p = pad(n, chords, 16, amp=.14, cut=1300)
    buf += np.stack([p, np.roll(p, int(.013 * SR))])
    w = wind(n, 260, 1200, .07)
    buf += np.stack([w, np.roll(w, int(1.7 * SR))])
    for at in [5, 13.5, 22, 31, 40.5, 49, 57.5]:
        f = rng.uniform(620, 1500)
        place(buf, pan(.06 * bell(f, 4, decay=2.5, ratios=(1, 2.76, 5.4, 8.93)), rng.uniform(-.8, .8)), at)
    for at in [9, 35, 52]:
        m = int(1.2 * SR)
        k = filt(noise(m), 'band', (90, 260)) * expdec(m, .25)
        place(buf, pan(.35 * k, rng.uniform(-.6, .6)), at)
    return norm_rms(loop_reverb(buf, size=4.0, mix=.45, pre=.04, damp=3000, seed=20), -21)


def amb_wohn(L=64):
    n = int(L * SR)
    buf = np.zeros((2, n))
    buf += stereo(drone(n, ['A1'], 140, 420, lfo=1 / 64, amp=.26))
    buf += stereo(.05 * filt(saw(hz('Bb1'), n), 'low', 300) * (0.5 + 0.5 * sine(1 / 16, n)))  # Halbtonreibung
    chords = [['A2', 'C3', 'E3', 'B3'], ['Bb2', 'D3', 'F3'], ['A2', 'C3', 'G3'], ['G2', 'Bb2', 'D3']]
    p = pad(n, chords, 16, amp=.11, cut=1000)
    buf += np.stack([np.roll(p, int(.02 * SR)), p])
    w = wind(n, 200, 700, .045, period=32)
    buf += np.stack([w, np.roll(w, int(2.3 * SR))])
    # Spieluhr: langsames Motiv, leicht verstimmt (leierndes Band), weit weg
    motif = ['A5', 'C6', 'E6', 'D6', 'C6', 'B5', 'G5', 'A5']
    for rep, at0 in enumerate([6, 38]):
        for i, note in enumerate(motif):
            f = hz(note) * (1 + .008 * np.sin(i * 1.7 + rep))
            x = bell(f, 2.5, decay=1.6, ratios=(1, 3.0, 5.1), amps=(1, .25, .08))
            place(buf, pan(.07 * filt(x, 'low', 3500), -.5 + i * .12), at0 + i * .85 + rng.uniform(-.05, .05))
    for at in [17, 29, 51, 60]:
        m = int(1.6 * SR)
        cut = np.linspace(300, 900, m) + 200 * np.sin(np.linspace(0, 20, m))
        cr = sweep(noise(m) * (rng.random(m) < .05), 'low', cut) * env(m, a=.3, d=.6, s=.3, r=.6)
        place(buf, pan(.5 * filt(cr, 'high', 150), rng.uniform(-.8, .8)), at)
    return norm_rms(loop_reverb(buf, size=4.5, mix=.5, pre=.05, damp=2600, seed=21), -22)


def amb_reaktor(L=64):
    n = int(L * SR)
    buf = np.zeros((2, n))
    t = np.arange(n) / SR
    hum = filt(square(hz('A1'), n, .4) + .5 * square(hz('A2'), n, .3), 'low', 380)
    puls = 0.65 + 0.35 * np.sin(2 * np.pi * .75 * t) ** 2
    buf += stereo(.16 * hum * puls)
    buf += stereo(drone(n, ['A1', 'E2', 'A2'], 140, 500, lfo=1 / 16, amp=.18, detune=1.007))
    chords = [['A2', 'E3', 'A3'], ['F2', 'C3', 'F3'], ['G2', 'D3', 'G3'], ['E2', 'B2', 'E3']]
    p = pad(n, chords, 16, amp=.09, cut=900, voice='saw')
    buf += np.stack([p, np.roll(p, int(.017 * SR))])
    # Maschinenschlag alle 2 Sekunden
    for k in range(int(L / 2)):
        m = int(.5 * SR)
        th = sine(70 * np.exp(-np.arange(m) / (.05 * SR)) + 38, ) * expdec(m, .1) + .4 * filt(noise(m), 'low', 600) * expdec(m, .04)
        place(buf, .32 * th, k * 2 + .02)
        if k % 4 == 3:
            place(buf, pan(.12 * bell(hz('E5') * 1.03, 1.2, decay=.4, ratios=(1, 2.3, 3.7)), .5), k * 2 + 1.0)
    # Dampfstöße
    for at in [7.3, 19.1, 27.7, 41.2, 55.6]:
        m = int(1.4 * SR)
        st = filt(noise(m), 'band', (2500, 9000)) * env(m, a=.02, d=.3, s=.35, r=.9)
        place(buf, pan(.18 * st, rng.uniform(-.9, .9)), at)
    return norm_rms(loop_reverb(buf, size=2.8, mix=.35, pre=.03, damp=3500, seed=22), -20)


def amb_brut(L=64):
    n = int(L * SR)
    buf = np.zeros((2, n))
    t = np.arange(n) / SR
    buf += stereo(drone(n, ['A1', 'Eb2'], 120, 480, lfo=1 / 32, amp=.26, detune=1.009))
    # Formant-Fläche (Chor-artig), Tritonus-Cluster
    x = np.zeros(n)
    for note in ['A2', 'Eb3', 'Bb3', 'E4']:
        x += saw(hz(note), n) + saw(hz(note) * 1.005, n)
    vowel = 500 + 350 * np.sin(2 * np.pi * t / 16)
    form = sweep(x / 8, 'low', vowel + 400) - .6 * sweep(x / 8, 'low', vowel)
    buf += np.stack([.10 * form, .10 * np.roll(form, int(.03 * SR))])
    # Herzschlag 60 BPM (lub-dub)
    for k in range(L):
        for off, amp in [(0, 1), (.28, .65)]:
            m = int(.35 * SR)
            hb = sine(52 * np.exp(-np.arange(m) / (.07 * SR)) + 34) * expdec(m, .09)
            place(buf, .42 * amp * filt(hb, 'low', 200), k + off)
    # Gurgeln
    for at in [4.5, 15, 23.5, 33, 44, 50.5, 59]:
        m = int(1.3 * SR)
        g = filt(noise(m), 'band', (180, 900)) * np.abs(sine(11 + rng.uniform(0, 9), m)) * env(m, a=.1, d=.4, s=.4, r=.6)
        place(buf, pan(.3 * g, rng.uniform(-.8, .8)), at)
    # Flüstern (hochgefilterte Rauschformanten)
    for at in [11, 37]:
        m = int(2.5 * SR)
        wh = filt(noise(m), 'band', (2500, 6000)) * env(m, a=.6, d=.6, s=.4, r=1) * (0.5 + 0.5 * np.abs(sine(3.3, m)))
        place(buf, pan(.09 * wh, rng.uniform(-.9, .9)), at)
    return norm_rms(loop_reverb(buf, size=4.0, mix=.45, pre=.04, damp=2400, seed=23), -20)


def drum(m_dur, f0, f1, tau, nz=.4, ncut=900):
    m = int(m_dur * SR)
    return sine(f0 * np.exp(-np.arange(m) / (tau * SR)) + f1) * expdec(m, tau * 2.2) + nz * filt(noise(m), 'low', ncut) * expdec(m, tau * .6)


def kampf(L=32, boss=False):
    """90 BPM, Takt = 4 Schläge, 32 s = 12 Takte."""
    n = int(L * SR)
    buf = np.zeros((2, n))
    beat = 60 / 90
    bars = round(L / (4 * beat))
    kick = [0, 1.5, 2, 3.5] if not boss else [0, .75, 1.5, 2, 2.75, 3.5]
    for bar in range(bars):
        for b in kick:
            place(buf, .8 * drum(.6, 120, 42, .06), (bar * 4 + b) * beat)
        for b in [1, 3]:  # tiefe Trommel / Taiko
            place(buf, pan(.5 * drum(.8, 180, 70, .09, nz=.7, ncut=1500), -.3 if b == 1 else .3), (bar * 4 + b) * beat)
        for s in range(16):  # leise Sechzehntel
            m = int(.06 * SR)
            h = filt(noise(m), 'high', 7000) * expdec(m, .012) * (.22 if s % 4 == 2 else .1)
            place(buf, pan(h, .4), (bar * 4 + s / 4) * beat)
    # Bass-Ostinato in Achteln auf A (Takt 5–6: F und G), Boss mit Tritonus Eb
    half = (['A1'] * 32 + ['F1'] * 8 + ['G1'] * 8) if not boss else (['A1'] * 24 + ['Eb2'] * 8 + ['A1'] * 8 + ['Bb1'] * 8)
    second = (['A1'] * 32 + ['C2'] * 8 + ['E1'] * 8) if not boss else (['A1'] * 16 + ['Eb2'] * 16 + ['Bb1'] * 8 + ['E2'] * 8)
    seq = half + second
    for i, note in enumerate(seq):
        m = int(beat / 2 * SR)
        f = hz(note)
        x = (saw(f, m) + saw(f * 1.01, m)) * env(m, a=.004, d=.18, s=.25, r=.05)
        x = filt(x, 'low', 520 if not boss else 900)
        if boss:
            x = soft(x * 1.5, 2.5)
        place(buf, .28 * x, i * beat / 2)
    if boss:  # metallische Stöße
        for bar in range(bars):
            place(buf, pan(.18 * bell(hz('Eb5'), 1.0, decay=.35, ratios=(1, 2.2, 3.5, 5.9)), .5 - .2 * (bar % 2)), (bar * 4 + 2.5) * beat)
    # Aufbau im letzten Takt
    m = int(4 * beat * SR)
    riser = sweep(noise(m), 'low', np.linspace(300, 6000, m)) * np.linspace(0, 1, m) ** 2
    place(buf, .14 * riser, (bars * 4 - 4) * beat)
    return norm_rms(loop_reverb(buf, size=1.4, mix=.2, pre=.01, damp=5000, seed=24 + boss), -19)


MUSIC = {
    'amb_fracht': (amb_fracht, 64), 'amb_wohn': (amb_wohn, 64), 'amb_reaktor': (amb_reaktor, 64), 'amb_brut': (amb_brut, 64),
    'kampf': (lambda L: kampf(L, False), 32), 'kampf_boss': (lambda L: kampf(L, True), 32),
}


# ---------------------------------------------------------------- Ausgabe
PAD = 1.0  # Sekunden Puffer vor und hinter jedem Musik-Loop
def write_wav(path, x):
    x = stereo(x)
    pcm = (np.clip(x, -1, 1).T * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def encode(wav, name, music):
    for ext, args in (('mp3', ['-c:a', 'libmp3lame', '-b:a', '128k']),):
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', wav, *args, os.path.join(OUT, f'{name}.{ext}')], check=True)


def main():
    only = set(sys.argv[1:])
    os.makedirs(OUT, exist_ok=True)
    manifest_path = os.path.join(OUT, 'manifest.json')
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {'sfx': {}, 'music': {}}
    with tempfile.TemporaryDirectory() as tmp:
        for name, fn in SFX.items():
            if only and name not in only:
                continue
            x = stereo(fn())
            x = norm_peak(np.stack([filt(c, 'high', 25) for c in x]), -1.5)  # ohne Gleichanteil
            wav = os.path.join(tmp, name + '.wav')
            write_wav(wav, x)
            encode(wav, name, False)
            manifest['sfx'][name] = round(x.shape[1] / SR, 3)
            print(f'Effekt {name}: {x.shape[1] / SR:.2f} s')
        for name, (fn, L) in MUSIC.items():
            if only and name not in only:
                continue
            assert (L * SR) % 1152 == 0, f'{name}: Loop-Länge muss ein Vielfaches von 1152 Samples sein'
            global LOOP
            LOOP = L
            x = fn(L)
            LOOP = None
            # OGG/MP3 verfälschen Dateianfang und -ende leicht. Darum je 1 s Puffer aus dem Loop selbst
            # davor und dahinter; das Spiel loopt nur den Bereich PAD .. PAD+L (jedes Fenster der Länge L
            # in diesem Puffer ist nahtlos, auch wenn ein MP3-Decoder den Anfang etwas verschiebt).
            p = int(PAD * SR)
            padded = np.concatenate([x[:, -p:], x, x[:, :p]], axis=1)
            wav = os.path.join(tmp, name + '.wav')
            write_wav(wav, padded)
            encode(wav, name, True)
            manifest['music'][name] = {'loop': L, 'pad': PAD}
            print(f'Musik {name}: {L} s, RMS {20 * np.log10(np.sqrt(np.mean(x ** 2))):.1f} dB')
    json.dump(manifest, open(manifest_path, 'w'), indent=1, sort_keys=True)


if __name__ == '__main__':
    main()
