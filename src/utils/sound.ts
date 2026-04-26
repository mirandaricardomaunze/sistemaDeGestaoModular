// Web Audio API — no external files needed, works offline/PWA

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
    try {
        if (!ctx || ctx.state === 'closed') {
            ctx = new AudioContext();
        }
        return ctx;
    } catch {
        return null;
    }
}

// Chime: two overlapping sine tones (E5 → C5), gentle envelope
export function playCalendarChime() {
    const ac = getCtx();
    if (!ac) return;

    const notes = [659.25, 523.25]; // E5, C5
    const now = ac.currentTime;

    notes.forEach((freq, i) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();

        osc.connect(gain);
        gain.connect(ac.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.18);

        // Attack → sustain → decay
        gain.gain.setValueAtTime(0, now + i * 0.18);
        gain.gain.linearRampToValueAtTime(0.25, now + i * 0.18 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.9);

        osc.start(now + i * 0.18);
        osc.stop(now + i * 0.18 + 0.9);
    });
}

// Short single beep — for generic alerts
export function playAlertBeep() {
    const ac = getCtx();
    if (!ac) return;

    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ac.currentTime);

    gain.gain.setValueAtTime(0, ac.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, ac.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3);

    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.3);
}
