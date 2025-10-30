function initCountdown(lockTimeStr, resetTimeStr) {
  const lockTime = new Date(lockTimeStr);
  const resetTime = new Date(resetTimeStr);

  const hourEl = document.getElementById("hourCount");
  const minEl = document.getElementById("minCount");
  const secEl = document.getElementById("secCount");
  const submitBtn = document.getElementById("submit-btn");

  function updateCountdown() {
    const now = new Date();
    const diff = lockTime - now;

    if (diff <= 0) {
      hourEl.textContent = "0";
      minEl.textContent = "00";
      secEl.textContent = "00";
      if (submitBtn) submitBtn.disabled = true;
      clearInterval(timer);
      return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    hourEl.textContent = hours;
    minEl.textContent = minutes.toString().padStart(2, "0");
    secEl.textContent = seconds.toString().padStart(2, "0");
  }

  updateCountdown();
  const timer = setInterval(updateCountdown, 1000);

  // Optional: auto-refresh at reset
  if (resetTime) {
    const msUntilReset = resetTime - new Date();
    if (msUntilReset > 0) {
      setTimeout(() => window.location.reload(), msUntilReset);
    }
  }
}