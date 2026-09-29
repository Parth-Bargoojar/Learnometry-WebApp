(function () {
  try {
    var p = localStorage.getItem("lm-theme") || "system";
    var d = p === "dark" || (p === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = d ? "dark" : "light";
  } catch (e) {}
})();
