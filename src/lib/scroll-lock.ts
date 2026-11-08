/** Блокировка прокрутки страницы под открытым оверлеем (модалка/шторка).
 *  Счётчик — модалки открываются стопкой (меню → импорт), и каждая при
 *  закрытии не должна снимать чужой lock.
 *  ВАЖНО: блокируем и <html>, и <body> — у html задан overflow-x:hidden,
 *  поэтому overflow с body НЕ прокидывается на вьюпорт, и lock только
 *  на body не останавливает свайп страницы под оверлеем. */
let lockCount = 0

export function lockBodyScroll() {
  if (++lockCount === 1) {
    document.documentElement.style.overflow = "hidden"
    document.body.style.overflow = "hidden"
  }
}

export function unlockBodyScroll() {
  if (lockCount > 0 && --lockCount === 0) {
    document.documentElement.style.overflow = ""
    document.body.style.overflow = ""
  }
}
