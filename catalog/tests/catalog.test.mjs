import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
const manifest=JSON.parse(fs.readFileSync('manifest.json','utf8'));
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const sources=[...manifest.components,...manifest.supportFiles];
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)]);
test('public catalog manifest inventories every reusable module exactly once',()=>{
 assert.equal(manifest.status,'public-modules'); assert.equal(manifest.components.length,153); assert.equal(sources.length,169);
 assert.equal(new Set(sources).size,sources.length);
 assert.deepEqual(sources.slice().sort(), ['components','hooks','data','utils'].flatMap(walk).filter(p=>/\.tsx?$/.test(p)).sort());
});
test('imports stay inside catalog and use declared dependencies',()=>{
 const declared=new Set([...Object.keys(pkg.dependencies),...Object.keys(pkg.devDependencies)]);
 for(const file of sources){ const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
 const check=node=>{if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier){const imp=node.moduleSpecifier.text;
 if(imp.startsWith('.')){const base=path.normalize(path.join(path.dirname(file),imp)); assert.ok(!base.startsWith('..'),`${file}: escape`); assert.ok([base,base+'.ts',base+'.tsx',base+'/index.ts',base+'/index.tsx'].some(p=>sources.includes(p)),`${file}: missing ${imp}`);}
 else { const name=imp.startsWith('@')?imp.split('/').slice(0,2).join('/'):imp.split('/')[0];assert.ok(declared.has(name),`${file}: undeclared ${imp}`);}}
 ts.forEachChild(node,check);};check(ast);
 }
});
test('no website infrastructure, private references, or old branding',()=>{
 for(const file of sources){assert.doesNotMatch(file,/(?:App|main|.*Page)\.tsx$|sponsorCheckout|googleAnalytics/);assert.doesNotMatch(fs.readFileSync(file,'utf8'),/rudder|zeeland|undertone|@vercel\/analytics|googletagmanager|gtag\(|import\.meta\.env|\/Users\//i);}
 assert.equal(pkg.private,true);
});
test('catalog fallback never claims an unavailable npm component',async()=>{
 const result=await build({entryPoints:['data/installCommand.ts'],bundle:true,write:false,format:'cjs',platform:'node'});
 const module={exports:{}};new Function('module','exports',result.outputFiles[0].text)(module,module.exports);
assert.match(module.exports.getInstallCommand('not-in-registry'),/not available/);
assert.doesNotMatch(module.exports.getInstallCommand('not-in-registry'),/npx/);
 assert.match(module.exports.getInstallCommand('not-in-registry'),/@mova-ui\/react\/catalog/);
 assert.match(module.exports.getInstallCommand('not-in-registry'),/registry\/manifest\.json/);
});
test('representative reusable components render without website context',async()=>{
 const input=`import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server';
 import {CardArc5} from './components/cards/CardArc5';
 import Budget from './components/metrics/Budget';
 import {ScrambleHover} from './components/css-animations/ScrambleHover';
 import {MonoRoundedBarChart} from './components/mono-charts/MonoRoundedBarChart';
 export function smoke(){return renderToStaticMarkup(<><CardArc5 hovered={true}/><Budget/><ScrambleHover text="Catalog smoke"/><MonoRoundedBarChart/></>);}`;
 const result=await build({stdin:{contents:input,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'cjs',platform:'node',packages:'external'});
 const module={exports:{}}; new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
 const html=module.exports.smoke();
 for(const text of ['<div','BUDGET','Catalog smoke','Mono Pill Pillars']) assert.ok(html.includes(text),text);
});
