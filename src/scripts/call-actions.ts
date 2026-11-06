// 전화 카드 동작: 번호 복사, 1388 지역번호 선택 → 휴대전화 링크. 아무것도 저장하거나 보내지 않음.
let bound = false;
export function bindCallActions() {
  if (bound) return;
  bound = true;
  document.addEventListener('click', async (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-copy-num]');
    if (!b) return;
    const done = (b.closest('.call-card') ?? b.parentElement)?.querySelector<HTMLElement>('[data-done]');
    try {
      await navigator.clipboard.writeText(b.dataset.copyNum!);
      if (done) done.textContent = `${b.dataset.copyNum} 복사했어요.`;
    } catch {
      if (done) done.textContent = '복사하지 못했어요. 번호를 직접 적어 주세요.';
    }
  });
  document.querySelectorAll<HTMLElement>('[data-area]').forEach((root) => {
    const sel = root.querySelector<HTMLSelectElement>('[data-area-select]')!;
    const a = root.querySelector<HTMLAnchorElement>('[data-area-call]')!;
    const num = root.dataset.area!.replace(/[^0-9]/g, '');
    sel.addEventListener('change', () => {
      if (sel.value) {
        a.href = `tel:${sel.value}${num}`;
        a.textContent = `☎ 휴대전화로 전화하기 (${sel.value}-${num})`;
        a.removeAttribute('aria-disabled');
      } else {
        a.removeAttribute('href');
        a.textContent = '☎ 휴대전화로 전화하기';
        a.setAttribute('aria-disabled', 'true');
      }
    });
  });
}
