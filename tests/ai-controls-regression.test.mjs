import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readSource = (path) => readFileSync(path, 'utf8');
const sidebar = readSource('source-registry/ui/ai/ai-sidebar-nav.tsx');
const prompt = readSource('source-registry/ui/ai/ai-prompt-bar.tsx');
const approval = readSource('source-registry/ui/ai/ai-approval-card.tsx');
const tokens = readSource('source-registry/ui/ai/ai-design-tokens.css');

test('AI prompt and sidebar keyboard focus uses rounded parent treatments', () => {
  assert.match(prompt, /\.prompt-composer:focus-within\s*\{\s*outline:2px solid/);
  assert.match(prompt, /:is\(input,textarea\):focus-visible\s*\{\s*outline:none/);
  assert.doesNotMatch(prompt, /:is\(button,input,textarea\):focus-visible/);

  assert.match(sidebar, /\.sidebar-search:focus-within\s*\{\s*outline:2px solid/);
  assert.match(sidebar, /input:focus-visible\s*\{\s*outline:none/);
  assert.match(sidebar, /button:focus-visible\s*\{\s*outline:2px solid[^}]*border-radius:8px/);
  assert.doesNotMatch(sidebar, /:is\(button,input,textarea\):focus-visible/);
});

test('Chats heading expands and collapses a keyboard-safe, searchable history region', () => {
  assert.match(sidebar, /aria-label="Chats"[\s\S]*?aria-expanded=\{chatsExpanded\}[\s\S]*?aria-controls=\{historyId\}[\s\S]*?onClick=\{toggleChats\}/);
  assert.match(sidebar, /id=\{historyId\}[\s\S]*?aria-hidden=\{!chatsExpanded\}[\s\S]*?inert=\{!chatsExpanded\}/);
  assert.match(sidebar, /id=\{historyId\}[\s\S]*?min-h-0 flex-1 overflow-y-auto transition-\[clip-path,opacity\]/);
  assert.ok(sidebar.includes('clipPath: chatsExpanded ? "inset(0)" : "inset(0 0 100% 0)"'));
  assert.match(sidebar, /recents\.filter\(\(item\) => item\.label\.toLowerCase\(\)\.includes\(query\.trim\(\)\.toLowerCase\(\)\)\)/);
  assert.match(sidebar, /onClick=\{\(\) => \{ setChatsExpanded\(true\); setSearchOpen\(true\); \}\}/);
  assert.match(sidebar, /sidebar-search[\s\S]*?aria-hidden=\{!searchOpen\}[\s\S]*?inert=\{!searchOpen\}[\s\S]*?pointer-events-none opacity-0/);
  assert.doesNotMatch(sidebar, /Chats selected|\$\{footerLabel\} selected/);
  assert.match(sidebar, /<p role="status" className="sr-only">\{feedback\}<\/p>/);
});

test('approval Continue uses theme-aware contrast and brightens while pressed', () => {
  assert.match(approval, /accent:"approval-accent/);
  assert.match(approval, /--approval-action-bg:#f5f5f5;--approval-action-fg:#202020;--approval-action-hover:#fff/);
  assert.match(approval, /--approval-action-disabled-bg:#3b3b3b;--approval-action-disabled-fg:#929292/);
  assert.match(approval, /\.approval-accent:disabled\{[^}]*opacity:1/);
  assert.match(approval, /active:brightness-110/);
  assert.match(approval, /--approval-action-bg:#454545;--approval-action-fg:#fff/);
  assert.match(tokens, /--mova-ai-accent: #454545;/);
});
