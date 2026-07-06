/// <reference types="vite/client" />
declare module '*.css';
// show-me-the-coffee 는 타입 선언(.d.ts)을 제공하지 않아 tsc 빌드가 실패한다. 최소 선언으로 통과시킨다.
declare module 'show-me-the-coffee' {
  // SMTC('boot', options) — 후원 위젯 부트. 옵션 스키마는 런타임에서만 검증되므로 느슨하게 둔다.
  export function SMTC(action: string, options?: Record<string, unknown>): void;
}
