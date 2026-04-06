// Pont auth Ekko ↔ extension Chrome
// Injecté sur getekko.eu/* uniquement par le manifest
window.addEventListener("message", (event) => {
  // Sécurité : ignorer tout message qui ne vient pas de getekko.eu
  if (event.origin !== "https://getekko.eu") return;

  const { type, access_token, user_id } = event.data || {};

  if (type === "EKKO_AUTH" && access_token && user_id) {
    chrome.storage.local.set({ access_token, user_id });
  }

  if (type === "EKKO_LOGOUT") {
    chrome.storage.local.remove(["access_token", "user_id"]);
  }
});