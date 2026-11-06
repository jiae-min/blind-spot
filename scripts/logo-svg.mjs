// 로고 "blind spot"을 Kanit Regular 400 글자 모양 그대로 SVG 경로로 만든다 (D-031).
// 로고 열 글자 때문에 Kanit 글꼴 파일(19KB)을 받지 않기 위함. 로고 문구·글꼴을 바꿀 때만 다시 실행.
//   node scripts/logo-svg.mjs   → src/data/logo.ts 갱신
// Kanit은 SIL Open Font License 1.1 (public/licenses 참고). 글자를 도형으로 바꿔 로고에 쓰는 것은 허용됨.
import { create } from 'fontkitten';
import { readFileSync, writeFileSync } from 'node:fs';

const TEXT = 'blind spot';
const font = create(readFileSync(new URL('../node_modules/@fontsource/kanit/files/kanit-latin-400-normal.woff2', import.meta.url)));
let x = 0, d = '';
for (const g of font.glyphsForString(TEXT)) {
  d += g.path.scale(1, -1).translate(x, font.ascent).toSVG();
  x += g.advanceWidth;
}
d = d.replace(/-?\d+\.\d+/g, (n) => String(Math.round(+n))); // 1/1000 em 단위 반올림 — 눈에 보이는 차이 없음
const h = font.ascent - font.descent;
writeFileSync(new URL('../src/data/logo.ts', import.meta.url),
  `// 로고 "${TEXT}" — Kanit Regular 400 글자 모양을 SVG 경로로 바꾼 것 (D-031). scripts/logo-svg.mjs가 만듦, 직접 고치지 말 것.\n` +
  `// 단위: 1000 = 글자 크기(em). w=전체 너비, h=ascent-descent.\n` +
  `export const LOGO = { w: ${Math.round(x)}, h: ${Math.round(h)}, d: ${JSON.stringify(d)} };\n`);
console.log(`logo.ts: ${d.length} chars`);
