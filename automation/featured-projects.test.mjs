import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { START, END, selectProjects, replaceSection, generateProjects, createApi, updateReadme } from './featured-projects.mjs';

const repo = (name, extra = {}) => ({name, owner:{login:'Juani-Alvares'}, private:false, fork:false, archived:false, topics:['featured'], description:'A project', ...extra});
test('selects only public, owned, featured, original and active projects in stable order', () => {
  const repos=[repo('z'),repo('A'),repo('fork',{fork:true}),repo('archive',{archived:true}),repo('private',{private:true}),repo('plain',{topics:[]}),repo('Juani-Alvares'),repo('other',{owner:{login:'someone'}})];
  assert.deepEqual(selectProjects(repos).map(r=>r.name),['A','z']);
});
test('preserves everything outside the markers byte-for-byte, including CRLF', () => {
  for (const newline of ['\n','\r\n']) {
    const before=`Banner${newline}${START}${newline}old${newline}${END}${newline}Stats & Snake`;
    const after=replaceSection(before,'new\ntext');
    assert.equal(after,`Banner${newline}${START}${newline}${newline}new${newline}text${newline}${newline}${END}${newline}Stats & Snake`);
    assert.equal(replaceSection(after,'new\ntext'),after);
  }
});
test('rejects missing, duplicate or reversed markers',()=>{
  for(const input of ['',START,END+START,START+START+END,START+END+END]) assert.throws(()=>replaceSection(input,'x'));
});
test('paginates, reads actual languages, escapes metadata and handles missing descriptions', async()=>{
  const calls=[];
  const result=await generateProjects(async path=>{
    calls.push(path);
    if(path.endsWith('page=1')) return Array.from({length:100},(_,i)=>repo(`plain-${i}`,{topics:[]}));
    if(path.endsWith('page=2')) return [repo('B',{description:null}),repo('A',{description:'<script>\n[click](evil) <!-- FEATURED-PROJECTS:END -->'})];
    return {JavaScript:100,CSS:50,HTML:50,Empty:0};
  });
  assert.equal(calls.length,4);
  assert.match(result,/JavaScript · CSS · HTML/);
  assert(!result.includes('<script>'));
  assert(!result.includes(END));
  assert.match(result,/Explore the source code/);
  assert.match(result,/https:\/\/github.com\/Juani-Alvares\/A/);
  assert(result.indexOf('/ A')<result.indexOf('/ B'));
});
test('empty selection is explicit and invalid API data fails closed', async()=>{
  assert.equal(await generateProjects(async()=>[]),'No featured projects selected yet.');
  await assert.rejects(generateProjects(async()=>({error:true})));
  await assert.rejects(generateProjects(async path=>path.includes('/languages')?{JS:'invalid'}:[repo('A')]));
  await assert.rejects(createApi('',async()=>({ok:false,status:403}))('/test'),/403/);
});
test('API failures leave README untouched and a repeated generation does not write', async()=>{
  const dir=await mkdtemp(join(tmpdir(),'featured-'));
  const file=join(dir,'README.md');
  try {
    const original=`before\n${START}\nold\n${END}\nafter`;
    await writeFile(file,original);
    await assert.rejects(updateReadme({file,api:async()=>{throw Error('API unavailable');}}));
    assert.equal(await readFile(file,'utf8'),original);
    const api=async path=>path.includes('/languages')?{JavaScript:50}:[repo('A')];
    assert.equal(await updateReadme({file,api}),true);
    assert.equal(await updateReadme({file,api}),false);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
