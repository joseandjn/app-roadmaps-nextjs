// Scrolls the view's own scroll container so the item's bar (anything with
// data-item-id) is centered, and flashes it. Returns false when the current
// view doesn't draw that item (outside the date window, collapsed lane,
// non-timeline view).
export function scrollToItem(id: string): boolean {
  const el = document.querySelector<HTMLElement>(`[data-item-id="${id}"]`)
  if (!el) return false
  // Scroll just the view's container: scrollIntoView would also shift
  // overflow-hidden ancestors and cut off the sticky label column.
  const box = el.closest<HTMLElement>('.overflow-auto')
  if (box) {
    const er = el.getBoundingClientRect(), br = box.getBoundingClientRect()
    box.scrollBy({
      left: er.left + er.width / 2 - (br.left + br.width / 2),
      top: er.top + er.height / 2 - (br.top + br.height / 2),
      behavior: 'smooth',
    })
  }
  el.animate([{ outline: '2px solid #3b6ef5', outlineOffset: '2px' }, { outline: '2px solid transparent', outlineOffset: '2px' }], { duration: 1400, easing: 'ease-out' })
  return true
}
