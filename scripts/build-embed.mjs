// Builds the app as ONE self-contained HTML file (for sharing as a claude.ai
// preview link). Run: npm run build:embed  ->  dist-embed/auction-manager.html
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

execSync('npx vite build --mode embed', { stdio: 'inherit' });

const dir = 'dist-embed/assets';
const files = readdirSync(dir);
const js = files.filter((f) => f.endsWith('.js'));
const css = files.filter((f) => f.endsWith('.css'));
if (js.length !== 1) throw new Error('Expected one JS bundle, found: ' + js.join(', '));

const script = readFileSync(join(dir, js[0]), 'utf8').replaceAll('</script', '<\\/script');
const styles = css.map((f) => readFileSync(join(dir, f), 'utf8')).join('\n').replaceAll('</style', '<\\/style');

const html = `<title>Auction Manager</title>
<meta name="theme-color" content="#0E1726">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">
<style>${styles}</style>
<div id="root"></div>
<script type="module">${script}</script>
`;
writeFileSync('dist-embed/auction-manager.html', html);
console.log('Wrote dist-embed/auction-manager.html (' + Math.round(html.length / 1024) + ' KB)');
