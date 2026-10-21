/**
 * Set once app/index.tsx has finished booting (migrations, goal growth) and
 * routed to Today or the intro. Navigation triggered from outside a screen,
 * such as a reminder tap, waits for it so it never races the boot screen.
 */
let bootComplete = false;

export function markBootComplete(): void {
  bootComplete = true;
}

export function isBootComplete(): boolean {
  return bootComplete;
}
