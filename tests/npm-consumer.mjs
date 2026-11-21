// Actual tarball acceptance: no workspace links or fabricated registry responses.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, readdirSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
const root = resolve(import.meta.dirname, '..');
const lockedDependencies = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8')).packages;
// Use the reviewed React declaration stack for the strict consumer check.
const lockedReactTypes = ['@types/react', '@types/react-dom', 'csstype'].map(
  (name) => `${name}@${lockedDependencies[`node_modules/${name}`].version}`,
);
const temp = mkdtempSync(join(tmpdir(), 'mova-consumer-'));
const run = (cmd, args, cwd = temp) => execFileSync(cmd, args, {cwd, encoding:'utf8', env:{...process.env, NODE_ENV: args.includes('vite') && args.includes('build') ? 'production' : 'development'}, stdio:['ignore','pipe','pipe']});
try {
  const packed = JSON.parse(run('npm', ['pack', '.', '--ignore-scripts', '--json', '--pack-destination', temp], root))[0];
  for (const file of packed.files) {
    assert.match(file.path, /^(package\.json|README\.md|bin\/mova\.mjs|registry\/[a-z0-9-]+\.json|dist\/(?:blocks\/assets\/ASSETS\.txt|blocks\/[\w./-]+\.(?:js|d\.ts|css|json|webp)|catalog\/[\w./-]+\.(?:js|d\.ts)|catalog-chunks\/[\w.-]+\.js|[\w/-]+\.d\.ts|index\.js|styles\.css))$/, file.path);
  }
  assert.equal(packed.files.some(file => /(?:^|\/)(?:LICENSE|LICENCE|NOTICE)(?:[./-]|$)/i.test(file.path)), false, 'no SDK or vendored license files in the prepared tarball');
  assert.equal(packed.files.some(file => /\.woff2$/.test(file.path)), false, 'font files remain external dependencies');
  console.log(`Pack allowlist PASS: ${packed.files.length} files, ${packed.size} compressed bytes`);
  writeFileSync(join(temp, 'package.json'), JSON.stringify({name:'mova-package-consumer', private:true, type:'module'}));
  console.log(run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', join(temp,packed.filename), 'react@19', 'react-dom@19', 'typescript@5.8.3', ...lockedReactTypes, 'vite@6']));
  const installed = join(temp,'node_modules/@mova-ui/react');
  function inspect(dir) {
    for(const e of readdirSync(dir,{withFileTypes:true})) {
      const p = join(dir,e.name); if(e.isDirectory()) inspect(p); else {
        const text = readFileSync(p,'utf8');
        assert.doesNotMatch(text, /\/Users\/|\/private\/tmp\/|(?:sk-[a-zA-Z0-9]{20,})/, p);
      }
    }
  }
  inspect(installed);
  const blockSources = JSON.parse(readFileSync(join(installed, 'dist/blocks/sources.json'), 'utf8'));
  for (const block of blockSources.blocks) {
    for (const file of block.files) {
      const target = join(temp, 'src/blocks', file.path);
      mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, file.content);
    }
    for (const asset of block.assets) {
      const target = join(temp, 'src/blocks', asset.path);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(join(installed, 'dist/blocks', asset.path), target);
    }
  }
  const list = run('npx', ['--no-install','@mova-ui/react','list']).trim().split('\n');
  const sourceCount = readdirSync(join(root,'registry')).filter(f=>f.endsWith('.json') && f !== 'manifest.json').length;
  assert.equal(list.length, sourceCount); assert.equal(new Set(list).size, sourceCount);
  assert.match(run('npx', ['--no-install','@mova-ui/react','--help']), /@mova-ui\/react add/);
  console.log(run('npx', ['--no-install','@mova-ui/react','add','glow-button']));
  console.log(run('npx', ['--no-install','@mova-ui/react','add','classic-toggle']));
  console.log(run('npx', ['--no-install','@mova-ui/react','add','gooey-popover']));
  for (const id of ['imessage-chat', 'calendar-day-card', 'balance-bar-chart-card', 'liquid-glass-sheet', 'day-trading-order-ticket', 'voice-assistant-card']) {
    console.log(run('npx', ['--no-install', '@mova-ui/react', 'add', id]));
  }
  for (const id of ['blur-fade', 'fold-panel', 'compare-slider', 'blur-carousel', 'long-press-context-menu', 'gesture-range-slider', 'split-view', 'animated-mega-menu', 'infinite-menu', 'infinite-card-grid', 'spatial-music-gallery']) {
    assert.ok(list.includes(id), id);
    console.log(run('npx', ['--no-install', '@mova-ui/react', 'add', id]));
  }
  const newComponents = {
    'gooey-input': 'GooeyInput', 'link-preview': 'LinkPreview', 'vanish-input': 'VanishInput',
    'notch': 'Notch', 'flip-words': 'FlipWords',
    'typewriter-effect': 'TypewriterEffect', 'text-generate-effect': 'TextGenerateEffect',
    'container-scroll-animation': 'ContainerScrollAnimation', 'sticky-scroll-reveal': 'StickyScrollReveal',
    'svg-mask-effect': 'SvgMaskEffect', 'direction-aware-hover': 'DirectionAwareHover',
    'comet-card': 'CometCard', 'draggable-card': 'DraggableCard', 'focus-cards': 'FocusCards',
    'expandable-card': 'ExpandableCard', 'pixelated-canvas': 'PixelatedCanvas', 'tooltip-card': 'TooltipCard',
  };
  for (const [id, name] of Object.entries(newComponents)) {
    assert.ok(list.includes(id), id);
    console.log(run('npx', ['--no-install', '@mova-ui/react', 'add', id]));
    const registry = JSON.parse(readFileSync(join(installed, 'registry', id + '.json'), 'utf8'));
    assert.ok(registry.exports.includes(name), id);
  }
  const exportCheck = `import * as ui from '@mova-ui/react'; for (const name of ${JSON.stringify(Object.values(newComponents))}) { if (typeof ui[name] !== 'function') throw new Error(name); }`;
  run('node', ['--input-type=module', '-e', exportCheck]);
  assert.ok(JSON.parse(readFileSync(join(temp, 'package.json'), 'utf8')).dependencies.gsap, 'GSAP installed automatically');
  console.log(run('node', ['--input-type=module','-e', `import React from 'react'; import {renderToString} from 'react-dom/server'; import * as ui from '@mova-ui/react'; const html=renderToString(React.createElement(ui.GlowButton,null,'Consumer proof')); if(!html.includes('Consumer proof')) throw new Error('SSR failed'); const galleries=[ui.InfiniteMenu,ui.InfiniteCardGrid,ui.SpatialMusicGallery]; for(const Component of galleries) { if(typeof Component!=='function') throw new Error('Missing gallery export'); const markup=renderToString(React.createElement(Component,{items:[{id:'consumer',image:'/portrait.webp',title:'Consumer gallery',artist:'Mova',duration:18}],height:400,count:6})); if(!markup.includes('Consumer gallery')) throw new Error('Gallery SSR failed'); } console.log('ESM imports/gallery SSR PASS:', Object.keys(ui).length, 'exports');`]));
  writeFileSync(join(temp,'App.tsx'), `import React from 'react';
import { createRoot } from 'react-dom/client';
import { BlurFade as PackageBlurFade, GlowButton, FadeIn, ClassicSpinner, PageTransition, useWebHaptics, InfiniteMenu as PackageInfiniteMenu, InfiniteCardGrid as PackageInfiniteCardGrid, SpatialMusicGallery as PackageSpatialMusicGallery } from '@mova-ui/react';
import '@mova-ui/react/styles.css';
import { CalendarBlock, CanvasBlock, CameraBlock, WrappedBlock } from '@mova-ui/react/blocks';
import '@mova-ui/react/blocks/styles.css';
import { CameraBlock as CopiedCameraBlock } from './src/blocks/CameraBlock';
import { WrappedBlock as CopiedWrappedBlock } from './src/blocks/WrappedBlock';
import { GlowButton as CopiedButton } from './src/components/mova/glow-button';
import { ClassicToggle } from './src/components/mova/classic-toggle';
import GooeyPopover from './src/components/mova/gooey-popover';
import './src/components/mova/styles.css';
import { IMessageChat } from './src/components/mova/imessage-chat';
import { CalendarDayCard } from './src/components/mova/calendar-day-card';
import { BalanceBarChartCard } from './src/components/mova/balance-bar-chart-card';
import { LiquidGlassSheet } from './src/components/mova/liquid-glass-sheet';
import { DayTradingOrderTicket } from './src/components/mova/day-trading-order-ticket';
import { VoiceAssistantCard } from './src/components/mova/voice-assistant-card';
import { FoldPanel } from './src/components/mova/fold-panel';
import { CompareSlider } from './src/components/mova/compare-slider';
import { BlurFade } from './src/components/mova/blur-fade';
import { BlurCarousel } from './src/components/mova/blur-carousel';
import { ContextMenu } from './src/components/mova/long-press-context-menu';
import { GestureRangeSlider } from './src/components/mova/gesture-range-slider';
import { SplitView } from './src/components/mova/split-view';
import { AnimatedMegaMenu } from './src/components/mova/animated-mega-menu';
import { InfiniteMenu, type InfiniteMenuItem } from './src/components/mova/infinite-menu';
import { InfiniteCardGrid, type InfiniteCardGridItem } from './src/components/mova/infinite-card-grid';
import { SpatialMusicGallery, type SpatialMusicTrack } from './src/components/mova/spatial-music-gallery';
const musicTracks: SpatialMusicTrack[] = [{ id: 'local', title: 'Consumer music', artist: 'Mova', image: '/portrait.webp', duration: 18, src: '/audio/local.mp3' }];
const galleryItems = [{ image: '/portrait.webp', title: 'Consumer gallery', description: 'Gallery detail', link: '/gallery' }] satisfies InfiniteCardGridItem[];
const sphereItems: InfiniteMenuItem[] = galleryItems;
function App() {
  return <FadeIn>
    <CopiedCameraBlock thumbnail/><CopiedWrappedBlock thumbnail/><CalendarBlock thumbnail/><CanvasBlock thumbnail/><CameraBlock thumbnail/><WrappedBlock thumbnail/><GlowButton>Library</GlowButton><CopiedButton>Copied</CopiedButton><ClassicSpinner/>
    <IMessageChat/><CalendarDayCard/><BalanceBarChartCard/><LiquidGlassSheet/>
    <DayTradingOrderTicket/><VoiceAssistantCard/><ClassicToggle/>
    <GooeyPopover><p>Popover content</p></GooeyPopover>
    <FoldPanel title="Details"><p>Body</p></FoldPanel>
    <CompareSlider before={<span>A</span>} after={<span>B</span>} accessibilityLabel="Compare A and B"/>
    <PackageBlurFade>Package reveal</PackageBlurFade>
    <BlurFade inView direction="left" delay={0.12}><p>Copied reveal</p></BlurFade>
    <BlurCarousel data={['One', 'Two']} renderItem={({ item }) => <span>{item}</span>}/>
    <ContextMenu items={[{ id: 'copy', label: 'Copy' }]}>Message</ContextMenu>
    <GestureRangeSlider min={1} max={10} defaultValue={4}/>
    <SplitView top={<span>Top</span>} bottom={<span>Bottom</span>}/>
    <PackageSpatialMusicGallery items={musicTracks} height={720}/>
    <SpatialMusicGallery items={musicTracks} title="My collection" subtitle="Local tracks" cardWidth={220} gap={40} focusScale={1.35} edgeScale={0.55} falloff={1} dim={0.6} momentum={0.75} volume={0.65} height={720} theme="dark" defaultQueue={['local']} defaultFavorites={['local']} onTrackChange={(track, index) => console.log(track.id, index)} onQueueChange={ids => console.log(ids.length)}/>
    <PackageInfiniteMenu items={sphereItems} height={400} count={40}/>
    <PackageInfiniteCardGrid items={galleryItems} height={400} momentum={0.35} theme="dark"/>
    <InfiniteMenu items={sphereItems} height={400} count={160} tileSize={0.63} roundness={0.2} zoom={1.65} pullBack={1} stretch={0.6} inertia={0.6} autoplay={0} grayscale={false} dim={0.5} intro={false} showInfo theme="light" onActiveChange={(item, index) => console.log(item.title, index)}/>
    <InfiniteCardGrid items={galleryItems} height={400} cardWidth={260} cardHeight={180} gap={28} momentum={0.35} theme="dark" onItemClick={(item, index) => console.log(item.title, index)}/>
    <AnimatedMegaMenu items={[{ label: 'Components', links: [{ label: 'Buttons', href: '/buttons' }] }]}/>
  </FadeIn>;
}
createRoot(document.getElementById('root')!).render(<App/>);
`);
  writeFileSync(join(temp,'tsconfig.json'), JSON.stringify({compilerOptions:{target:'ES2020',module:'ESNext',moduleResolution:'Bundler',jsx:'react-jsx',strict:true,noEmit:true,skipLibCheck:false,esModuleInterop:true,lib:['ES2020','DOM']},include:['App.tsx','src/**/*.tsx']}));
  writeFileSync(join(temp,'index.html'), '<html><body><div id="root"></div><script type="module" src="/App.tsx"></script></body></html>');
  run('npx',['--no-install','tsc','--noEmit']); console.log('Fresh consumer strict typecheck PASS');
  console.log(run('npx',['--no-install','vite','build']));
  assert.ok(readdirSync(join(temp,'dist/assets')).some(f=>f.endsWith('.css')));
  const builtAssets = readdirSync(join(temp, 'dist/assets'));
  const builtText = builtAssets.filter(file => /\.(js|css)$/.test(file)).map(file => readFileSync(join(temp, 'dist/assets', file), 'utf8')).join('\n');
  for (const asset of blockSources.blocks[0].assets) {
    const original = asset.path.split('/').at(-1);
    const stem = original.replace(/\.[^.]+$/, '');
    const extension = original.slice(stem.length);
    const emitted = builtAssets.find(file => file.startsWith(`${stem}-`) && file.endsWith(extension));
    assert.ok(emitted, `Block asset emitted: ${original}`);
    assert.ok(builtText.includes(emitted), `Block asset referenced by compiled JS/CSS: ${original}`);
  }
  const emittedFonts = builtAssets.filter(file => file.endsWith('.woff2'));
  for (const family of ['dm-sans', 'instrument-serif', 'anton']) {
    const fonts = emittedFonts.filter(file => file.includes(family));
    assert.ok(fonts.length, `External Fontsource font emitted: ${family}`);
    assert.ok(fonts.every(file => builtText.includes(file)), `External Fontsource font referenced: ${family}`);
  }
  console.log(`Consumer acceptance PASS: ${list.length} offline CLI IDs, import/SSR, copied source, strict types, production React build, CSS and tarball privacy.`);
} finally { rmSync(temp,{recursive:true,force:true}); }
