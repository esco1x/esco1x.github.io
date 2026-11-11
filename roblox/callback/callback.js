(() => {
  "use strict";
  const params = new URLSearchParams(window.location.search);
  // Strip codes from the address bar/history before the user navigates elsewhere.
  window.history.replaceState(null, "", window.location.pathname);
  const title = document.getElementById("title");
  const status = document.getElementById("status");
  if (params.has("error")) {
    title.textContent = "Authorization was not completed";
    status.textContent = "Return to Discord and run /roblox login again when you are ready.";
    return;
  }
  const code = params.get("code");
  const state = params.get("state");
  if (!code && !state) return;
  if (!code || code.length > 3000 || !/^[A-Za-z0-9_-]{43}$/.test(state || "") ||
      params.getAll("code").length !== 1 || params.getAll("state").length !== 1) {
    title.textContent = "Invalid login result";
    status.textContent = "Return to Discord and run /roblox login to get a fresh link.";
    return;
  }
  title.textContent = "Your login result is ready";
  status.textContent = "Return to Discord now to finish linking your account. You are not linked until you submit the result there.";
  document.getElementById("result-panel").hidden = false;
  const result = document.getElementById("result");
  result.value = JSON.stringify({ code, state });
  const button = document.getElementById("copy");
  button.addEventListener("click", async () => {
    const notice = document.getElementById("copy-status");
    try {
      await navigator.clipboard.writeText(result.value);
      notice.textContent = "Copied! Return to Discord and paste it into the Login modal.";
    } catch {
      result.focus();
      result.select();
      notice.textContent = "Copy the selected text manually, then paste it into the Login modal in Discord.";
    }
  });
  window.setTimeout(() => {
    result.value = "";
    button.disabled = true;
    document.getElementById("expiry").textContent = "This code has expired. Run /roblox login in Discord for a fresh link.";
    document.getElementById("copy-status").textContent = "";
  }, 60000);
})();
