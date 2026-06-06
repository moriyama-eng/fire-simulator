import { vi } from 'vitest';

// HTMLAnchorElement.prototype.click をモックしてナビゲーションエラーを抑制
if (typeof window !== 'undefined' && HTMLAnchorElement.prototype.click) {
  HTMLAnchorElement.prototype.click = vi.fn();
}

// 必要に応じて、他のナビゲーション関連メソッドもモック
if (typeof window !== 'undefined' && window.open) {
  window.open = vi.fn();
}