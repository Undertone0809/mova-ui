import { getInstallCommand } from './installCommand';
import React from 'react';

export type FormInteractionType = 
  | 'floating-label-input'
  | 'input-focus-glow'
  | 'password-toggle'
  | 'search-expand'
  | 'checkbox-draw'
  | 'radio-scale'
  | 'error-shake'
  | 'success-check'
  | 'select-dropdown'
  | 'multi-select-chips'
  | 'textarea-auto-grow'
  | 'otp-input'
  | 'file-upload-dropzone'
  | 'range-slider'
  | 'form-submit-button';

export interface FormElementConfig {
  id: string;
  label: string;
  interactionType: FormInteractionType;
  description: string;
  cliCommand: string;
}

export const formElementsData: FormElementConfig[] = [
  {
    id: 'frm1',
    label: 'Floating Label Input',
    interactionType: 'floating-label-input',
    description: 'Label floats up cleanly on focus with spring displacement.',
    cliCommand: getInstallCommand('floating-label-input'),
  },
  {
    id: 'frm2',
    label: 'Input Focus Glow',
    interactionType: 'input-focus-glow',
    description: 'Soft animated halo glow expands on input field focus.',
    cliCommand: getInstallCommand('input-focus-glow'),
  },
  {
    id: 'frm3',
    label: 'Password Toggle',
    interactionType: 'password-toggle',
    description: 'Eye icon morphs smoothly to reveal or hide password characters.',
    cliCommand: getInstallCommand('password-toggle'),
  },
  {
    id: 'frm4',
    label: 'Search Expand',
    interactionType: 'search-expand',
    description: 'Minimal search pill expands laterally on focus with icon shift.',
    cliCommand: getInstallCommand('search-expand'),
  },
  {
    id: 'frm5',
    label: 'Checkbox Path Draw',
    interactionType: 'checkbox-draw',
    description: 'Custom checkbox with animated SVG checkmark stroke on select.',
    cliCommand: getInstallCommand('checkbox-draw'),
  },
  {
    id: 'frm6',
    label: 'Radio Scale',
    interactionType: 'radio-scale',
    description: 'Radio button scales with spring physics and fills inner core.',
    cliCommand: getInstallCommand('radio-scale'),
  },
  {
    id: 'frm7',
    label: 'Error Shake',
    interactionType: 'error-shake',
    description: 'Horizontal elastic shake vibration on input validation failure.',
    cliCommand: getInstallCommand('error-shake'),
  },
  {
    id: 'frm8',
    label: 'Success Check Draw',
    interactionType: 'success-check',
    description: 'Green checkmark path draws upon successful field validation.',
    cliCommand: getInstallCommand('success-check'),
  },
  {
    id: 'frm9',
    label: 'Select Dropdown',
    interactionType: 'select-dropdown',
    description: 'Custom select menu expands with origin-aware scale & blur fade.',
    cliCommand: getInstallCommand('select-dropdown'),
  },
  {
    id: 'frm10',
    label: 'Multi-Select Chips',
    interactionType: 'multi-select-chips',
    description: 'Selected tag items pop into view as dismissible animated chips.',
    cliCommand: getInstallCommand('multi-select-chips'),
  },
  {
    id: 'frm11',
    label: 'Textarea Auto-Grow',
    interactionType: 'textarea-auto-grow',
    description: 'Textarea container height expands smoothly with input content length.',
    cliCommand: getInstallCommand('textarea-auto-grow'),
  },
  {
    id: 'frm12',
    label: 'OTP 4-Digit Input',
    interactionType: 'otp-input',
    description: 'Character boxes with automatic focus advance & spring highlight.',
    cliCommand: getInstallCommand('otp-input'),
  },
  {
    id: 'frm13',
    label: 'File Upload Dropzone',
    interactionType: 'file-upload-dropzone',
    description: 'Drag-over pulsing border ring with upload arrow icon animation.',
    cliCommand: getInstallCommand('file-upload-dropzone'),
  },
  {
    id: 'frm14',
    label: 'Spring Range Slider',
    interactionType: 'range-slider',
    description: 'Slider thumb with spring bounce and floating value tooltip pop.',
    cliCommand: getInstallCommand('range-slider'),
  },
  {
    id: 'frm15',
    label: 'Form Submit Morph',
    interactionType: 'form-submit-button',
    description: 'Submit button morphs into loading spinner then checkmark state.',
    cliCommand: getInstallCommand('form-submit-button'),
  },
];
