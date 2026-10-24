// Public navigation stays functional without JavaScript; JS enhances the mobile menu.
(() => {
  const wrapper = document.querySelector(".navwrap");
  const toggle = wrapper?.querySelector(".nav-toggle");
  const menu = wrapper?.querySelector("#primary-navigation");
  if (!wrapper || !toggle || !menu) return;

  const setOpen = open => {
    menu.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.querySelector("[aria-hidden]")?.replaceChildren(document.createTextNode(open ? "×" : "☰"));
  };
  setOpen(false);
  wrapper.classList.add("nav-ready");
  toggle.addEventListener("click", () => setOpen(!menu.classList.contains("is-open")));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && menu.classList.contains("is-open")) {
      setOpen(false);
      toggle.focus();
    }
  });
})();
