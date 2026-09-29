(() => {
  "use strict";

  const DEFAULTS = {
    enabled: true,
    learnSynonyms: true,
    learnNotes: true,
    reviewTranslations: true
  };
  const REVIEW_SELECTOR = ".bp-sdw.bp-quiz-trans";
  const STATUS_ID = "bia-status";
  const STABLE_FOR_MS = 700;
  const TRANSLATION_TIMEOUT_MS = 20000;
  const MAX_SUMMARY_LENGTH = 3500;
  const INVALID_MEANINGS = new Set(["grammar", "vocab", "details", "summary"]);

  const translationCache = new Map();
  const reviewState = new WeakMap();
  const pendingReviewElements = new Set();
  let learnRunning = false;
  const completedLearnFeatures = new Set();
  let candidateLearnKey = "";
  let candidateSince = 0;
  let observerTimer;
  let reviewTimer;
  let sharedTranslatorPromise;
  let translationQueue = Promise.resolve();

  const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();

  function isVisible(element) {
    if (!element) return false;
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
  }

  function findByText(selector, expression, root = document) {
    return [...root.querySelectorAll(selector)].find((element) =>
      isVisible(element) && expression.test(normalize(
        element.textContent || element.value || element.getAttribute("aria-label") || element.title || ""
      ))
    );
  }

  async function waitFor(getter, timeout = 5000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const result = getter();
      if (result) return result;
      await sleep(100);
    }
    return null;
  }

  function setStatus(message, state = "working") {
    let status = document.getElementById(STATUS_ID);
    if (!status) {
      status = document.createElement("div");
      status.id = STATUS_ID;
      document.body.append(status);
    }
    status.dataset.state = state;
    status.textContent = message;
  }

  async function createTranslator() {
    if (!("Translator" in self)) {
      throw new Error("La Translator API non è disponibile in questa versione di Chrome.");
    }
    const options = { sourceLanguage: "en", targetLanguage: "it" };
    const availability = await Translator.availability(options);
    if (availability === "unavailable") {
      throw new Error("Il pacchetto di traduzione inglese→italiano non è disponibile.");
    }
    return Translator.create(options);
  }

  function getSharedTranslator() {
    if (!sharedTranslatorPromise) {
      sharedTranslatorPromise = createTranslator().catch((error) => {
        sharedTranslatorPromise = undefined;
        throw error;
      });
    }
    return sharedTranslatorPromise;
  }

  async function resetSharedTranslator() {
    if (!sharedTranslatorPromise) return;
    try {
      const translator = await sharedTranslatorPromise;
      translator.destroy?.();
    } catch {
      // La creazione era già fallita; basta scartare la sessione.
    }
    sharedTranslatorPromise = undefined;
  }

  async function translateWithTimeout(translator, text) {
    let timeout;
    try {
      return await Promise.race([
        translator.translate(text),
        new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new Error("La traduzione locale ha superato il tempo massimo.")), TRANSLATION_TIMEOUT_MS);
        })
      ]);
    } finally {
      clearTimeout(timeout);
    }
  }

  async function translateText(text) {
    const source = normalize(text);
    if (!source) return "";
    if (translationCache.has(source)) return translationCache.get(source);

    const request = translationQueue.catch(() => {}).then(async () => {
      const translator = await getSharedTranslator();
      try {
        return normalize(await translateWithTimeout(translator, source));
      } catch (error) {
        await resetSharedTranslator();
        throw error;
      }
    }).catch((error) => {
      translationCache.delete(source);
      throw error;
    });
    translationQueue = request;
    translationCache.set(source, request);
    return request;
  }

  function cleanTranslation(value) {
    return normalize(value)
      .replace(/^[“"']|[”"']$/g, "")
      .replace(/[.!;:]+$/g, "")
      .replace(/^(per|al fine di)\s+(?=[a-zà-ÿ]+are\b|[a-zà-ÿ]+ere\b|[a-zà-ÿ]+ire\b)/i, "")
      .trim();
  }

  function getLearnItem() {
    if (!location.pathname.startsWith("/learn")) return null;
    const title = [...document.querySelectorAll("h1")].find(isVisible);
    if (!title) return null;

    const preferred = [...document.querySelectorAll("[id^='rev-id-'] > span.mt-4, [id^='rev-id-'] span.mt-4")]
      .find(isVisible);
    const fallback = [...title.querySelectorAll("span,div")].find((element) => {
      const text = normalize(element.textContent);
      return isVisible(element) && /^[A-Za-z]/.test(text) && text.length > 1;
    });
    const meaning = normalize(preferred?.textContent || fallback?.textContent || "");
    if (!meaning || INVALID_MEANINGS.has(meaning.toLocaleLowerCase("en"))) return null;

    return {
      key: `${location.pathname}${location.search}|${normalize(title.textContent)}|${meaning}`,
      meaning,
      title: normalize(title.textContent)
    };
  }

  function splitMeanings(text) {
    const parts = [];
    let current = "";
    let depth = 0;
    for (const character of text) {
      if (character === "(") depth += 1;
      if (character === ")" && depth > 0) depth -= 1;
      if ((character === "," || character === ";") && depth === 0) {
        if (normalize(current)) parts.push(normalize(current));
        current = "";
      } else {
        current += character;
      }
    }
    if (normalize(current)) parts.push(normalize(current));
    return parts
      .map((part) => normalize(part.replace(/\s*\([^)]*e\.g\.[^)]*\)\s*/gi, " ")))
      .filter((part) => part && part.length <= 180)
      .slice(0, 12);
  }

  function extractMarkedTranslation(text, marker) {
    const expression = new RegExp(`\\[\\[${marker}\\]\\]\\s*(.*?)\\s*\\[\\[\\/${marker}\\]\\]`, "i");
    return normalize(text.match(expression)?.[1]);
  }

  async function translateLearnContent(item, summary, includeNotes, includeSynonyms) {
    const phrases = includeSynonyms ? splitMeanings(item.meaning) : [];
    const hasNote = includeNotes && Boolean(summary?.text);
    if (!hasNote && !phrases.length) return { note: "", synonyms: [] };

    setStatus(hasNote && phrases.length
      ? "Traduzione locale di riepilogo e sinonimi…"
      : hasNote ? "Traduzione del riepilogo nelle note…" : "Traduzione dei sinonimi…");

    if (!phrases.length) {
      return { note: await translateText(summary.text), synonyms: [] };
    }

    // Chrome può omettere i blocchi successivi in una singola traduzione. Si usa
    // quindi una sola coppia di marcatori e, quando serve, il riepilogo prosegue
    // nello stesso blocco di testo.
    const source = hasNote
      ? `[[BIASYN]] ${phrases.join(", ")} [[/BIASYN]]. Summary: ${summary.text}`
      : `[[BIASYN]] ${phrases.join(", ")} [[/BIASYN]]`;
    const result = await translateText(source);
    const markedSynonyms = extractMarkedTranslation(result, "BIASYN");
    const synonymsText = markedSynonyms || (!hasNote ? result : "");
    const synonyms = splitMeanings(cleanTranslation(synonymsText));
    let note = "";
    if (hasNote) {
      const closingMarker = result.match(/\[\[\/BIASYN\]\]/i);
      if (closingMarker?.index !== undefined) {
        note = normalize(result.slice(closingMarker.index + closingMarker[0].length))
          .replace(/^[\s.!;–—-]*(?:[^:]{1,60}:\s*)?/u, "");
      }
    }
    return {
      note,
      synonyms: [...new Map(synonyms.map((value) => [value.toLocaleLowerCase("it"), value])).values()]
    };
  }

  function getSynonymsSection() {
    const heading = findByText("h1,h2,h3,h4", /^Your Synonyms$/i);
    if (!heading) return null;
    let section = heading.parentElement;
    while (section && section !== document.body) {
      if (findByText("button", /^Edit$/i, section)) return section;
      section = section.parentElement;
    }
    return heading.parentElement;
  }

  function setInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function addSynonyms(translations) {
    const jumpButton = findByText("button", /^(Add Synonyms|Go to Synonyms)$/i);
    if (!jumpButton || !translations.length) return false;

    jumpButton.click();
    const findInputs = () => {
      const matches = [...document.querySelectorAll(
        "input#input, input[aria-label='New Synonym'], input[placeholder='New Synonym']"
      )].filter(isVisible);
      return matches.length ? matches : null;
    };
    let inputs = await waitFor(findInputs, 1200);
    if (!inputs) {
      const section = await waitFor(getSynonymsSection, 3000);
      const edit = section ? findByText("button", /^Edit$/i, section) : null;
      if (edit) edit.click();
      inputs = await waitFor(findInputs);
    }
    if (!inputs) throw new Error("Editor dei sinonimi non trovato.");

    const existing = new Set(inputs.map((input) => normalize(input.value).toLocaleLowerCase("it")).filter(Boolean));
    const pending = translations.filter((value) => !existing.has(value.toLocaleLowerCase("it")));
    if (!pending.length) {
      const discard = findByText("button", /^Discard Changes$/i);
      if (discard) discard.click();
      setStatus("I sinonimi italiani sono già presenti.", "success");
      return true;
    }

    for (const translation of pending) {
      let input = inputs.find((element) => !normalize(element.value));
      if (!input) {
        const add = findByText("button", /^Add Synonym$/i);
        if (!add) throw new Error("Pulsante Add Synonym non trovato.");
        const previousCount = inputs.length;
        add.click();
        input = await waitFor(() => {
          inputs = [...document.querySelectorAll(
            "input#input, input[aria-label='New Synonym'], input[placeholder='New Synonym']"
          )].filter(isVisible);
          return inputs.length > previousCount ? inputs.find((element) => !normalize(element.value)) : null;
        });
      }
      if (!input) throw new Error("Nuovo campo sinonimo non trovato.");
      setStatus(`Aggiunta del sinonimo: ${translation}`);
      input.focus();
      setInputValue(input, translation);
      await sleep(180);
    }

    const save = findByText("button", /^Save Changes$/i);
    if (!save) throw new Error("Pulsante Save Changes non trovato.");
    save.click();
    await waitFor(() => !isVisible(save), 4000);
    setStatus(`Salvati ${pending.length} sinonimi italiani.`, "success");
    return true;
  }

  function headingLevel(heading) {
    return Number(heading?.tagName.slice(1)) || 6;
  }

  function textAfterHeading(heading, maximum = MAX_SUMMARY_LENGTH) {
    if (!heading) return "";
    const level = headingLevel(heading);
    const end = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6,ul,ol")].find((candidate) =>
      heading.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_FOLLOWING &&
      ((/^H[1-6]$/.test(candidate.tagName) && headingLevel(candidate) <= level) || /^(UL|OL)$/.test(candidate.tagName))
    );
    const range = document.createRange();
    range.setStartAfter(heading);
    if (end) range.setEndBefore(end);
    else range.setEndAfter(document.body.lastChild || document.body);
    return normalize(range.toString()).slice(0, maximum);
  }

  function getLearnSummary() {
    const bunproSummary = findByText("h1,h2,h3,h4", /^Bunpro Summary$/i);
    if (bunproSummary) {
      return { label: "RIEPILOGO BUNPRO", text: textAfterHeading(bunproSummary) };
    }
    const grammarSummary = findByText("h1,h2,h3,h4", /^About\s+/i);
    if (grammarSummary) {
      return { label: "RIEPILOGO GRAMMATICALE", text: textAfterHeading(grammarSummary) };
    }
    return null;
  }

  function setEditableContent(editor, value) {
    editor.focus();
    if (editor instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      if (setter) setter.call(editor, value);
      else editor.value = value;
    } else {
      const paragraph = document.createElement("p");
      paragraph.textContent = value;
      editor.replaceChildren(paragraph);
    }
    editor.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: value
    }));
    editor.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function addTranslatedNote(summary, italian, itemKey) {
    if (!summary?.text) return false;
    const existing = findByText("button", /^Edit Note$/i);
    const legacyGeneratedNote = findByText(
      "p,div,span",
      /^(RIEPILOGO BUNPRO|RIEPILOGO GRAMMATICALE):/i
    );
    const stored = await chrome.storage.local.get({ generatedLearnNotes: {} });
    const generatedLearnNotes = stored.generatedLearnNotes || {};
    const isGenerated = Boolean(legacyGeneratedNote || generatedLearnNotes[itemKey]);
    if (existing && !isGenerated) {
      setStatus("Nota già presente: non è stata modificata.", "success");
      return true;
    }
    const add = findByText("button", /^Add Note$/i);
    const open = isGenerated ? existing : add;
    if (!open) return false;

    if (!italian) throw new Error("La traduzione del riepilogo non è stata riconosciuta.");
    open.click();
    const editor = await waitFor(() => [...document.querySelectorAll(
      "[contenteditable='true'][role='textbox'], .ProseMirror[contenteditable='true'], textarea"
    )].find(isVisible));
    if (!editor) throw new Error("Editor delle note non trovato.");

    setEditableContent(editor, italian);
    await sleep(900);
    const close = findByText("button", /^Close$/i);
    if (!close) throw new Error("Pulsante Close delle note non trovato.");
    close.click();
    await waitFor(() => !isVisible(editor), 4000);
    generatedLearnNotes[itemKey] = true;
    await chrome.storage.local.set({ generatedLearnNotes });
    setStatus("Riepilogo italiano salvato nelle note.", "success");
    return true;
  }

  async function processLearn() {
    if (learnRunning || !location.pathname.startsWith("/learn")) return;
    const settings = await chrome.storage.sync.get(DEFAULTS);
    if (!settings.enabled || (!settings.learnSynonyms && !settings.learnNotes)) return;

    const item = getLearnItem();
    if (!item) return;
    if (item.key !== candidateLearnKey) {
      candidateLearnKey = item.key;
      candidateSince = Date.now();
      return;
    }
    if (Date.now() - candidateSince < STABLE_FOR_MS) return;

    const synonymsKey = `${item.key}|synonyms`;
    const notesKey = `${item.key}|notes`;
    const shouldProcessSynonyms = settings.learnSynonyms &&
      findByText("button", /^(Add Synonyms|Go to Synonyms)$/i) &&
      !completedLearnFeatures.has(synonymsKey);
    const shouldProcessNotes = settings.learnNotes && !completedLearnFeatures.has(notesKey);
    if (!shouldProcessSynonyms && !shouldProcessNotes) return;

    learnRunning = true;
    try {
      const summary = getLearnSummary();
      const translated = await translateLearnContent(
        item,
        summary,
        shouldProcessNotes,
        shouldProcessSynonyms
      );

      if (shouldProcessNotes && await addTranslatedNote(summary, translated.note, item.key)) {
        completedLearnFeatures.add(notesKey);
      }
      if (shouldProcessSynonyms && await addSynonyms(translated.synonyms)) {
        completedLearnFeatures.add(synonymsKey);
      }
    } catch (error) {
      console.error("[Bunpro Italian Assistant: Learn]", error);
      setStatus(error instanceof Error ? error.message : String(error), "error");
    }
    learnRunning = false;
  }

  function idToLetters(id) {
    let result = "";
    let value = id + 1;
    while (value > 0) {
      value -= 1;
      result = String.fromCharCode(65 + (value % 26)) + result;
      value = Math.floor(value / 26);
    }
    return result;
  }

  function buildMarkedSource(element) {
    let output = "";
    let markerCount = 0;
    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        output += node.nodeValue;
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (node.classList.contains("bia-original-tooltip")) return;
      if (node.tagName === "STRONG" || node.tagName === "B") {
        const marker = idToLetters(markerCount++);
        output += ` [[BIA${marker}]] `;
        [...node.childNodes].forEach(walk);
        output += ` [[/BIA${marker}]] `;
      } else {
        [...node.childNodes].forEach(walk);
      }
    };
    walk(element);
    return { text: normalize(output), markerCount };
  }

  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderMarkedTranslation(text, markerCount) {
    let html = escapeHtml(text);
    let intact = markerCount > 0;
    for (let index = 0; index < markerCount; index += 1) {
      const marker = idToLetters(index);
      const open = new RegExp(`\\s*\\[\\[BIA${marker}\\]\\]\\s*`, "i");
      const close = new RegExp(`\\s*\\[\\[/BIA${marker}\\]\\]\\s*`, "i");
      if (!open.test(html) || !close.test(html)) intact = false;
      html = html.replace(open, "<strong>").replace(close, "</strong>");
    }
    return intact ? html : escapeHtml(text.replace(/\s*\[\[\/?BIA[A-Z]+\]\]\s*/gi, " "));
  }

  async function translateReviewElement(element) {
    if (!element.isConnected || !isVisible(element)) return;
    const state = reviewState.get(element) || { version: 0, translated: "" };
    reviewState.set(element, state);
    const visibleText = normalize(element.innerText);
    if (!visibleText || visibleText === state.translated || !/[A-Za-z]/.test(visibleText)) return;

    const { text: source, markerCount } = buildMarkedSource(element);
    if (!source || source === state.source) return;
    state.source = source;
    const version = ++state.version;

    try {
      const translated = await translateText(source);
      if (!element.isConnected || state.version !== version || normalize(element.innerText) !== visibleText) return;
      element.innerHTML = renderMarkedTranslation(translated, markerCount);
      state.translated = normalize(element.innerText);
      element.dataset.biaOriginal = visibleText;
      element.title = visibleText;
      element.classList.add("bia-translated-review");
    } catch (error) {
      console.error("[Bunpro Italian Assistant: Review]", error);
      state.source = "";
    }
  }

  function queueReviewElement(element) {
    if (!location.pathname.startsWith("/reviews")) return;
    if (!(element instanceof Element) || !element.matches(REVIEW_SELECTOR)) return;
    pendingReviewElements.add(element);
    clearTimeout(reviewTimer);
    reviewTimer = setTimeout(async () => {
      const settings = await chrome.storage.sync.get(DEFAULTS);
      const pending = [...pendingReviewElements];
      pendingReviewElements.clear();
      if (!settings.enabled || !settings.reviewTranslations) return;
      pending.forEach(translateReviewElement);
    }, 180);
  }

  function scanReviewNode(node) {
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    const target = element?.closest(REVIEW_SELECTOR);
    if (target) queueReviewElement(target);
    element?.querySelectorAll?.(REVIEW_SELECTOR).forEach(queueReviewElement);
  }

  function scheduleLearn() {
    clearTimeout(observerTimer);
    observerTimer = setTimeout(processLearn, 250);
  }

  if (location.pathname.startsWith("/reviews")) {
    document.querySelectorAll(REVIEW_SELECTOR).forEach(queueReviewElement);
  }
  new MutationObserver((mutations) => {
    scheduleLearn();
    for (const mutation of mutations) {
      scanReviewNode(mutation.target);
      mutation.addedNodes.forEach(scanReviewNode);
    }
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });
  window.addEventListener("popstate", scheduleLearn);
  document.addEventListener("turbo:load", scheduleLearn);
  document.addEventListener("turbo:render", scheduleLearn);
  setInterval(scheduleLearn, 900);
  scheduleLearn();
})();
