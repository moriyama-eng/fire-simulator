// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getIsResultDirty,
  setDirty,
  markInputChanged,
  markResultClean,
  setButtonsEnabledForResult
} from '../../src/core/state.js';

describe('src/core/state.ts', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="shareXBtn"></button>
      <button id="saveImageBtn"></button>
      <button id="openCompareTabBtn"></button>
      <button id="copySimUrlBtn"></button>
    `;
    setDirty(false);
  });

  it('manages dirty flag via setDirty and getIsResultDirty', () => {
    expect(getIsResultDirty()).toBe(false);
    setDirty(true);
    expect(getIsResultDirty()).toBe(true);
    setDirty(false);
    expect(getIsResultDirty()).toBe(false);
  });

  it('markInputChanged sets dirty and disables buttons', () => {
    markInputChanged();
    expect(getIsResultDirty()).toBe(true);
    const btn = document.getElementById('shareXBtn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.title).toBeTruthy();
  });

  it('markResultClean clears dirty and enables buttons', () => {
    markInputChanged();
    markResultClean();
    expect(getIsResultDirty()).toBe(false);
    const btn = document.getElementById('shareXBtn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.title).toBe('');
  });

  it('setButtonsEnabledForResult handles missing buttons gracefully', () => {
    document.body.innerHTML = '';
    expect(() => setButtonsEnabledForResult(true)).not.toThrow();
    expect(() => setButtonsEnabledForResult(false)).not.toThrow();
  });

  it('markInputChanged uses globalThis.__t when defined', () => {
    const originalT = (globalThis as unknown as { __t?: unknown }).__t;
    try {
      (globalThis as unknown as { __t: (k: string) => string }).__t = (k: string) => `mock:${k}`;
      markInputChanged();
      const btn = document.getElementById('shareXBtn') as HTMLButtonElement;
      expect(btn.title).toBe('mock:button.tooltipDirty');
    } finally {
      if (originalT !== undefined) {
        (globalThis as unknown as { __t?: unknown }).__t = originalT;
      } else {
        delete (globalThis as unknown as Record<string, unknown>).__t;
      }
    }
  });

  it('markInputChanged falls back to English tooltip when __currentLang is en', () => {
    const prevLang = (globalThis as unknown as { __currentLang?: string }).__currentLang;
    try {
      (globalThis as unknown as { __currentLang: string }).__currentLang = 'en';
      markInputChanged();
      const btn = document.getElementById('shareXBtn') as HTMLButtonElement;
      expect(btn.title).toBe('Simulation has not been run (recalculation required)');
    } finally {
      if (prevLang !== undefined) {
        (globalThis as unknown as { __currentLang: string }).__currentLang = prevLang;
      } else {
        delete (globalThis as unknown as Record<string, unknown>).__currentLang;
      }
    }
  });
});
