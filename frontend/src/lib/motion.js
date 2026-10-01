// Whether the visitor has asked their system for less motion. Animations check this and land
// instead of travelling (the stylesheets do the same with @media (prefers-reduced-motion)).
export function prefersReducedMotion() {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}
