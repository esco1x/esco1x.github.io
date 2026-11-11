(() => {
  "use strict";
  const params = new URLSearchParams(window.location.search);
  // Strip codes from the address bar/history before the user navigates elsewhere.
  window.history.replaceState(null, "", window.location.pathname);
  const title = document.getElementById("title");
  const status = document.getElementById("status");
  if (params.has("error")) {
    title.textContent = "Login cancelled";
    status.textContent = "Run /roblox login in Discord to try again.";
    return;
  }
  const code = params.get("code");
  const state = params.get("state");
  if (!code && !state) return;
  if (!code || code.length > 3000 || !/^[A-Za-z0-9_-]{43}$/.test(state || "") ||
      params.getAll("code").length !== 1 || params.getAll("state").length !== 1) {
    title.textContent = "This link isn't valid";
    status.textContent = "Run /roblox login in Discord for a new link.";
    return;
  }
  title.textContent = "Finish linking Roblox";
  status.textContent = "Copy this result, then return to Discord. Click Login in your Bread message and paste it into the form.";
  document.getElementById("result-panel").hidden = false;
  const result = document.getElementById("result");
  result.value = JSON.stringify({ code, state });
  const button = document.getElementById("copy");
  button.addEventListener("click", async () => {
    const notice = document.getElementById("copy-status");
    try {
      await navigator.clipboard.writeText(result.value);
      notice.textContent = "Copied. Paste it into Bread's Login form in Discord.";
    } catch {
      result.focus();
      result.select();
      notice.textContent = "Copy the selected text manually, then paste it into Bread's Login form.";
    }
  });
  window.setTimeout(() => {
    result.value = "";
    button.disabled = true;
    document.getElementById("expiry").textContent = "Code expired. Run /roblox login in Discord to try again.";
    document.getElementById("copy-status").textContent = "";
  }, 60000);
})();
