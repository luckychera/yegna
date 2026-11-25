/** Leaves the app for an external page (the payment provider's checkout). Isolated so tests can stub it. */
export function redirectTo(url: string): void {
  window.location.assign(url);
}
