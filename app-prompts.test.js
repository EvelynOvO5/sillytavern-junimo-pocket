import test from 'node:test';
import assert from 'node:assert/strict';
import {promptDefinitions,normalizePromptOverrides,renderAppPrompt} from './app-prompts.js';
test('user style replaces defaults, empty restores defaults and formats remain protected',()=>{
 const values=normalizePromptOverrides({general:'只说两句\n称呼：{{name}}',style:''});
 assert.equal(renderAppPrompt('general',values),'只说两句\n称呼：{{name}}');
 assert(renderAppPrompt('style',values).includes('自然'));
 assert.equal(renderAppPrompt('private',{private:'不要输出JSON'},{name:'莱恩',id:'11'}),renderAppPrompt('private',{}, {name:'莱恩',id:'11'}));
 assert.throws(()=>normalizePromptOverrides({private:'x'}));assert.throws(()=>normalizePromptOverrides({unknown:'x'}));assert.throws(()=>normalizePromptOverrides({style:4}));assert.throws(()=>normalizePromptOverrides({style:'x'.repeat(24001)}));
});
test('all editable app defaults are present and runtime tokens resolve',()=>{
 assert.equal(new Set(promptDefinitions.map(p=>p.id)).size,promptDefinitions.length);
 const values={name:'莱恩',id:'11',members:'莱恩、莱尔',groups:'[]',letterLimit:4,items:'[]',cap:250,disabled:'spam',category:'只生成regular普通来信',stickers:'[]',preferences:'温柔',roles:'[]',shape:'{}',categories:'家具',progression:'成长规则',initialRule:'初始化',roleNames:'莱恩',places:'广场',missingRoles:'无',state:'已确认状态'};
 for(const p of promptDefinitions){const resolved=renderAppPrompt(p.id,{},values);assert(!resolved.includes('${'),p.id);assert(!/\{\{\w+\}\}/.test(resolved),p.id);}
 assert(renderAppPrompt('social',{},values).includes('letters最多4封'));
 assert(renderAppPrompt('categories',{},values).includes('关闭的类别禁止生成：spam'));
});
