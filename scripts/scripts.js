// FEDERATED CHILD bootstrap.
// The engine (ak.js) is imported via the same-origin /libs path. The Cloudflare
// worker proxies /libs/* to the FED origin server-side (no CORS). Because ak.js
// derives its codeBase from its own URL (/libs), ALL framework code — blocks,
// utils, styles — is then pulled from FED through /libs automatically. This site
// stays thin and only adds its own custom blocks/templates locally.
import { loadArea, setConfig } from '/libs/scripts/ak.js';

const hostnames = ['authorkit.dev'];

const locales = {
  '': { lang: 'en' },
};

const linkBlocks = [
  { fragment: '/fragments/' },
];

// Blocks with self-managed styles
const components = [];

export async function loadPage() {
  const config = setConfig({ hostnames, locales, linkBlocks, components });
  if (config.locale?.dir) document.documentElement.dir = config.locale.dir;
  await loadArea();
}

await loadPage();
