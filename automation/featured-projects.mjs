import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const START = '<!-- FEATURED-PROJECTS:START -->';
export const END = '<!-- FEATURED-PROJECTS:END -->';
const OWNER = 'Juani-Alvares';
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

// Treat repository metadata as text, never as Markdown or HTML instructions.
export function escapeText(value) {
  return String(value).replace(/\s+/g, ' ').trim()
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replace(/[\\`*_{}\[\]()#+.!|~-]/g, '\\$&');
}

export function replaceSection(readme, content) {
  if (readme.split(START).length !== 2 || readme.split(END).length !== 2) {
    throw new Error('README must contain exactly one pair of featured-project markers.');
  }
  const start = readme.indexOf(START) + START.length;
  const end = readme.indexOf(END);
  if (start > end) throw new Error('Featured-project markers are reversed.');
  const newline = readme.includes('\r\n') ? '\r\n' : '\n';
  return readme.slice(0, start) + newline + newline
    + content.replaceAll('\n', newline) + newline + newline + readme.slice(end);
}

export function selectProjects(repos, owner = OWNER) {
  return repos.filter(repo => repo.owner?.login.toLowerCase() === owner.toLowerCase()
    && repo.private === false && !repo.fork && !repo.archived
    && repo.name.toLowerCase() !== owner.toLowerCase()
    && repo.topics?.includes('featured'))
    .sort((a, b) => compare(a.name.toLowerCase(), b.name.toLowerCase()) || compare(a.name, b.name));
}

export function createApi(token = process.env.GITHUB_TOKEN, fetcher = fetch) {
  return async path => {
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'featured-profile-projects', 'X-GitHub-Api-Version': '2022-11-28' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetcher(`https://api.github.com${path}`, { headers, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`GitHub API ${response.status}: ${path}. README was not updated.`);
    return response.json();
  };
}

export async function generateProjects(api, owner = OWNER) {
  const repos = [];
  for (let page = 1; ; page++) {
    const batch = await api(`/users/${encodeURIComponent(owner)}/repos?type=owner&sort=full_name&direction=asc&per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error('Invalid repository response.');
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  const selected = selectProjects(repos, owner);
  const sections = [];
  for (const [index, repo] of selected.entries()) {
    const languages = await api(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo.name)}/languages`);
    if (!languages || Array.isArray(languages) || typeof languages !== 'object'
      || Object.values(languages).some(bytes => !Number.isFinite(bytes) || bytes < 0)) {
      throw new Error(`Invalid languages response for ${repo.name}.`);
    }
    const tech = Object.entries(languages).filter(([, bytes]) => bytes > 0)
      .sort((a, b) => b[1] - a[1] || compare(a[0], b[0])).map(([name]) => escapeText(name));
    const description = repo.description?.trim() || 'Explore the source code and documentation in this repository.';
    const url = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo.name)}`;
    sections.push(`### ${String(index + 1).padStart(2, '0')} / ${escapeText(repo.name)}\n\n${escapeText(description)}\n\n**Languages detected by GitHub:** ${tech.length ? tech.join(' · ') : 'Not available yet.'}\n\n[View code ↗](${url})`);
  }
  return sections.length ? sections.join('\n\n') : 'No featured projects selected yet.';
}

export async function updateReadme({ file = 'README.md', api = createApi() } = {}) {
  const before = await readFile(file, 'utf8');
  replaceSection(before, ''); // Fail before API requests if the markers are unsafe.
  const generated = await generateProjects(api);
  const after = replaceSection(before, generated);
  if (after === before) { console.log('Featured projects unchanged.'); return false; }
  await writeFile(file, after);
  console.log('Updated only the marked featured-projects section.');
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  updateReadme().catch(error => { console.error(error.message); process.exitCode = 1; });
}
