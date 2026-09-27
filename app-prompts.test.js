import test from 'node:test';
import assert from 'node:assert/strict';
import {promptDefinitions,normalizePromptOverrides,renderAppPrompt} from './app-prompts.js';
test('edited prompts replace defaults, preserve newlines, and interpolate once without code evaluation',()=>{
 const edited='只说两句\n称呼：{{name}}';
 const values=normalizePromptOverrides({private:edited,style:''});
 assert.equal(renderAppPrompt('private',values,{name:'{{id}}'}),'只说两句\n称呼：{{id}}');
 assert.equal(renderAppPrompt('style',values),'');
 assert.equal(renderAppPrompt('private',{}, {name:'莱恩',id:'11'}).includes('莱恩（ID 11）'),true);
 assert.throws(()=>normalizePromptOverrides({unknown:'x'}));
 assert.throws(()=>normalizePromptOverrides({style:4}));
 assert.throws(()=>normalizePromptOverrides({style:'x'.repeat(24001)}));
});
test('all editable app defaults are present and runtime tokens resolve',()=>{
 assert.equal(new Set(promptDefinitions.map(p=>p.id)).size,promptDefinitions.length);
 const values={name:'莱恩',id:'11',members:'莱恩、莱尔',groups:'[]',letterLimit:4,items:'[]',cap:250,disabled:'spam',category:'只生成regular普通来信',stickers:'[]',preferences:'温柔'};
 for(const p of promptDefinitions){const resolved=renderAppPrompt(p.id,{},values);assert(!resolved.includes('${'),p.id);assert(!/\{\{\w+\}\}/.test(resolved),p.id);}
 assert(renderAppPrompt('social',{},values).includes('letters最多4封'));
 assert(renderAppPrompt('categories',{},values).includes('关闭的类别禁止生成：spam'));
});
