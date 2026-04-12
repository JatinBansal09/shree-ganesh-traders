import Swal from 'sweetalert2';

// Base configuration to avoid repeating code
const TopRight = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: true,
  timerProgressBar: true,
  timer: 5000, // Toasts usually disappear, but Prompts will stay open
});

// 1. ALERT (Simple Notification)
export const toastAlert = (title, icon = 'success') => {
  TopRight.fire({
    title,
    icon,
    showConfirmButton: false, // No button needed for simple alerts
  });
};

// 2. CONFIRMATION (Top-Right with Buttons)
export const toastConfirm = (title, onConfirm) => {
  TopRight.fire({
    title,
    icon: 'warning',
    text: 'Confirm action?',
    timer: undefined, // Don't auto-close while waiting for a click
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Yes',
  }).then((result) => {
    if (result.isConfirmed) onConfirm();
  });
};

// 3. PROMPT (Top-Right with Input Field)
export const toastPrompt = (title, placeholder, onInput) => {
  TopRight.fire({
    title,
    input: 'text',
    inputPlaceholder: placeholder,
    timer: undefined, // Keep it open until they type
    showCancelButton: true,
    confirmButtonText: 'Submit',
  }).then((result) => {
    if (result.value) onInput(result.value);
  });
};