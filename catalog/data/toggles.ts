import { getInstallCommand } from './installCommand';
import React from 'react';

export type ToggleInteractionType = 
  | 'double-bounce-toggle'
  | 'solid-switch'
  | 'rectangle-toggle'
  | 'circle-toggle'
  | 'bookmark-toggle'
  | 'like-toggle'
  | 'dislike-toggle'
  | 'repost-toggle'
  | 'pill-tabs'
  | 'morph-toggle'
  | 'checkmark-draw'
  | 'theme-toggle';

export interface ToggleConfig {
  id: string;
  label: string;
  interactionType: ToggleInteractionType;
  description: string;
  cliCommand: string;
}

export const togglesData: ToggleConfig[] = [
  {
    id: 't-bounce',
    label: 'Double Bounce Switch',
    interactionType: 'double-bounce-toggle',
    description: 'Double bounce overshoot physics with a custom track clock.',
    cliCommand: getInstallCommand('double-bounce-toggle'),
  },
  {
    id: 't-solid',
    label: 'Solid Switch',
    interactionType: 'solid-switch',
    description: 'Crisp, high-contrast toggle with instant response.',
    cliCommand: getInstallCommand('solid-switch'),
  },
  {
    id: 't-rect',
    label: 'Rectangle Toggle',
    interactionType: 'rectangle-toggle',
    description: 'Minimal squarish toggle with sharp border radiuses.',
    cliCommand: getInstallCommand('rectangle-toggle'),
  },
  {
    id: 't-circle',
    label: 'Circle Curve Toggle',
    interactionType: 'circle-toggle',
    description: 'Ultra smooth circular pill switch with spring momentum.',
    cliCommand: getInstallCommand('circle-toggle'),
  },
  {
    id: 't-bookmark',
    label: 'Bookmark Action',
    interactionType: 'bookmark-toggle',
    description: 'Interactive save bookmark button with color fill & pop.',
    cliCommand: getInstallCommand('bookmark-toggle'),
  },
  {
    id: 't-like',
    label: 'Like Action',
    interactionType: 'like-toggle',
    description: 'Heart like button with spring burst & particle ring.',
    cliCommand: getInstallCommand('like-toggle'),
  },
  {
    id: 't-dislike',
    label: 'Dislike Action',
    interactionType: 'dislike-toggle',
    description: 'Thumbs down action button with active state highlight.',
    cliCommand: getInstallCommand('dislike-toggle'),
  },
  {
    id: 't-repost',
    label: 'Repost Action',
    interactionType: 'repost-toggle',
    description: 'Retweet / Repost button with 180° rotation & count update.',
    cliCommand: getInstallCommand('repost-toggle'),
  },
  {
    id: 't-pill',
    label: 'Pill Tabs Switcher',
    interactionType: 'pill-tabs',
    description: 'Minimalist sliding indicator tab switcher (Daily / Weekly / Monthly).',
    cliCommand: getInstallCommand('pill-tabs'),
  },
  {
    id: 't-morph',
    label: 'Morph Toggle',
    interactionType: 'morph-toggle',
    description: 'Icon morphs cleanly between locked and unlocked states.',
    cliCommand: getInstallCommand('morph-toggle'),
  },
  {
    id: 't-check',
    label: 'Checkmark Draw',
    interactionType: 'checkmark-draw',
    description: 'Sharp vector SVG checkmark path animation on activation.',
    cliCommand: getInstallCommand('checkmark-draw'),
  },
  {
    id: 't-theme',
    label: 'Theme Toggle',
    interactionType: 'theme-toggle',
    description: 'Minimal sun/moon swap with background transition.',
    cliCommand: getInstallCommand('theme-toggle'),
  },
];
