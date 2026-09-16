(() => {
  const STORAGE_KEY = "grok-transcript-theme";
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  function storedTheme() {
    try {
      const value = window.localStorage.getItem(STORAGE_KEY);
      return value === "light" || value === "dark" ? value : null;
    } catch {
      return null;
    }
  }

  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.dispatchEvent(new CustomEvent("transcriptthemechange", {
      detail: { theme },
    }));
  }

  function set(theme) {
    const normalized = theme === "dark" ? "dark" : "light";
    try {
      window.localStorage.setItem(STORAGE_KEY, normalized);
    } catch {
      // A blocked storage API should not block theme switching for this page load.
    }
    apply(normalized);
  }

  function current() {
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  }

  window.TranscriptTheme = {
    current,
    set,
    toggle() {
      set(current() === "dark" ? "light" : "dark");
    },
  };

  mediaQuery.addEventListener?.("change", (event) => {
    if (!storedTheme()) {
      apply(event.matches ? "dark" : "light");
    }
  });

  apply(storedTheme() || (mediaQuery.matches ? "dark" : "light"));
})();
