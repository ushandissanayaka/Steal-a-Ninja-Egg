// The only place Boxity URLs come from (docs.bloxity.io "Environments").
// Never hardcode a Boxity host, and never guess the environment from the page URL.

const PROD = {
  env: 'prod',
  apiUrl: 'https://api.bloxity.io',
  playUrl: 'https://play.bloxity.io',
  portalUrl: 'https://bloxity.io',
  staticUrl: 'https://static.bloxity.io',
};

export function boxityEnv() {
  const told = window.Legion?.SDK?.environment?.();
  if (told?.apiUrl) return told;
  if (window.BLOXITY_ENV?.apiUrl) return window.BLOXITY_ENV;
  return PROD;
}
