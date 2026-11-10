import fs from 'node:fs';
import assert from 'node:assert/strict';
const readme=fs.readFileSync('README.md','utf8');
const localImages=[...readme.matchAll(/<img[^>]+src="([^"]+)"/g)].map(m=>m[1]);
for(const file of localImages) {
  assert(!file.startsWith('http'),`External image dependency: ${file}`);
  assert(fs.existsSync(file),`Missing image: ${file}`);
  const svg=fs.readFileSync(file,'utf8');
  assert(svg.includes('<svg') && svg.includes('</svg>'),`Invalid SVG: ${file}`);
  assert(!/<script|<foreignObject|onload=|javascript:/i.test(svg),`Unsafe SVG: ${file}`);
  assert(fs.statSync(file).size<500000,`Oversized image: ${file}`);
}
assert(!/gh[pousr]_[A-Za-z0-9]{20,}|github_pat_/.test(readme),'Credential pattern in README');
console.log(`Validated ${localImages.length} local README images.`);
