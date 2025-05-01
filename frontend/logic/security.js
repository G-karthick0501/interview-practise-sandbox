let tabSwitchCount = 0;

function setupSecurity() {
  alert("⚠️ You cannot switch tabs once the test starts. Switching tabs will trigger warnings.\n\n➡️ 1st switch = Warning\n➡️ 2nd switch = Test Aborted");

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      tabSwitchCount++;

      if (tabSwitchCount === 1) {
        alert("⚠️ Warning: Do not switch tabs again. One more switch will abort the test.");
      } else if (tabSwitchCount >= 2) {
        alert("❌ You switched tabs twice. The interview is now terminated.");
        window.location.href = "abort.html";
      }
    }
  });
}

export { setupSecurity };
