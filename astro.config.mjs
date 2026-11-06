// @ts-check
import { defineConfig } from 'astro/config';

// Cloudflare Pages 배포 (D-001). 루트 경로로 서비스하므로 base 없음.
// Cloudflare 프로젝트 이름이 blind-spot이 아니게 되거나 개인 도메인을 붙이면 site 값을 바꾸세요.
export default defineConfig({
  site: 'https://blind-spot.pages.dev',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
