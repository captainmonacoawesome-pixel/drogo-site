// Public navigation stays functional without JavaScript; JS enhances the mobile menu.
(() => {
  const wrapper = document.querySelector(".navwrap");
  const toggle = wrapper?.querySelector(".nav-toggle");
  const menu = wrapper?.querySelector("#primary-navigation");
  if (wrapper && toggle && menu) {

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
  }

  // Staff shortcuts are not present in the public HTML. They are only
  // inserted after Cloudflare Access validates the existing staff session.
  async function showStaffMenu() {
    if (!wrapper) return;
    const staffPage = /^\\/admin\\/(?:ama|gallery)(?:\\/|$)/.test(location.pathname);
    if (!staffPage) {
      try {
        // HEAD uses the already-protected /api/ama/admin route and verifies
        // the signed Access JWT. 204 means authorised; every other outcome
        // (401, challenge/redirect, outage) hides the menu.
        const response = await fetch("/api/ama/admin", {
          method: "HEAD",
          credentials: "same-origin",
          redirect: "manual",
          cache: "no-store"
        });
        if (response.status !== 204) return;
      } catch (_) {
        return;
      }
    }

    const control = document.createElement("details");
    control.className = "staff-shortcuts";
    const summary = document.createElement("summary");
    summary.textContent = "⚙ Admin Pages";
    const links = document.createElement("nav");
    links.className = "staff-shortcuts-links";
    links.setAttribute("aria-label", "Admin pages");
    for (const [label, path] of [
      ["Answer AMA Questions", "/admin/ama/"],
      ["Manage Cat Photos", "/admin/gallery/"]
    ]) {
      const link = document.createElement("a");
      link.href = path;
      link.textContent = label;
      if (location.pathname === path) link.setAttribute("aria-current", "page");
      links.append(link);
    }
    control.append(summary, links);
    document.body.append(control);
    document.addEventListener("pointerdown", event => {
      if (control.open && !control.contains(event.target)) control.open = false;
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && control.open) {
        control.open = false;
        summary.focus();
      }
    });
  }
  showStaffMenu();
})();
