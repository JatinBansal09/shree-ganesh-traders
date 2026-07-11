import Swal from "sweetalert2";

// ── Bulletproof Native Web Audio API Engine ───────────────────────────────────
const playSynthSound = (type = "success") => {
  try {
    // 1. Initialize the browser's AudioContext
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    if (type === "success" || type === "info") {
      // 🎉 Cheerful double-beep chime
      // Note 1
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(523.25, now); // C5
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.08);

      // Note 2
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(659.25, now + 0.07); // E5
      gain2.gain.setValueAtTime(0.15, now + 0.07);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.07);
      osc2.stop(now + 0.22);
    } else if (type === "error") {
      // ❌ Harsh low buzzer/warning sound
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.linearRampToValueAtTime(90, now + 0.2); // Downward drop
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === "warning") {
      // ⚠️ Mid-tone warning double alert
      [0, 0.12].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(330, now + delay); // E4
        gain.gain.setValueAtTime(0.15, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 0.08);
      });
    }
  } catch (err) {
    console.warn("Audio Context blocked or uninitialized:", err);
  }
};

// ── Base SweetAlert2 config ───────────────────────────────────────────────────
const TopRight = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timerProgressBar: true,
  timer: 5000,
});

// 1. ALERT
export const toastAlert = (title, icon = "success") => {
  playSynthSound(icon);
  TopRight.fire({ title, icon, showConfirmButton: false });
};

// 2. CONFIRMATION
export const toastConfirm = (title, onConfirm) => {
  playSynthSound("warning");
  TopRight.fire({
    title,
    icon: "warning",
    text: "Confirm action?",
    timer: undefined,
    showCancelButton: true,
    confirmButtonColor: "#3085d6",
    cancelButtonColor: "#d33",
    confirmButtonText: "Yes",
  }).then((result) => {
    if (result.isConfirmed) onConfirm();
  });
};

// 3. PROMPT
export const toastPrompt = (title, placeholder, onInput) => {
  playSynthSound("info");
  TopRight.fire({
    title,
    input: "text",
    inputPlaceholder: placeholder,
    timer: undefined,
    showCancelButton: true,
    confirmButtonText: "Submit",
  }).then((result) => {
    if (result.value) onInput(result.value);
  });
};
