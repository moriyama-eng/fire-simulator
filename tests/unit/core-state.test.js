// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getIsResultDirty,
  setDirty,
  markInputChanged,
  markResultClean,
  setButtonsEnabledForResult
} from '../../js/core/state.js';

describe('js/core/state.js', () => {
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
    const btn = document.getElementById('shareXBtn');
    expect(btn.disabled).toBe(true);
    expect(btn.title).toBeTruthy();
  });

  it('markResultClean clears dirty and enables buttons', () => {
    markInputChanged();
    markResultClean();
    expect(getIsResultDirty()).toBe(false);
    const btn = document.getElementById('shareXBtn');
    expect(btn.disabled).toBe(false);
    expect(btn.title).toBe('');
  });

  it('setButtonsEnabledForResult handles missing buttons gracefully', () => {
    document.body.innerHTML = '';
    expect(() => setButtonsEnabledForResult(true)).not.toThrow();
    expect(() => setButtonsEnabledForResult(false)).not.toThrow();
  });
});
