const defaults = {
  enabled: true,
  learnSynonyms: true,
  learnNotes: true,
  reviewTranslations: true
};

async function load() {
  const settings = await chrome.storage.sync.get(defaults);
  for (const [key, value] of Object.entries(settings)) {
    const input = document.getElementById(key);
    if (input) input.checked = value;
  }
}

document.addEventListener("change", async (event) => {
  if (event.target instanceof HTMLInputElement) {
    await chrome.storage.sync.set({ [event.target.id]: event.target.checked });
  }
});

load();
