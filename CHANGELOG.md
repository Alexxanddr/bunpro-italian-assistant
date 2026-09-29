# Changelog

Il formato segue [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) e il progetto usa [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.1.0] - 2026-09-29

### Changed

- Le frasi Review vengono tradotte tramite il servizio gratuito MyMemory, con cache, timeout e tentativi automatici.
- Le traduzioni Learn continuano a usare la Translator API locale di Chrome.

## [1.0.15] - 2026-09-29

### Fixed

- Supporto alle carte senza sinonimi: `Add Synonyms` apre e inizializza l'editor anche quando `Your Synonyms` non è ancora presente nel DOM.

## [1.0.14] - 2026-09-29

### Fixed

- La sezione sinonimi risale al primo contenitore Bunpro che include realmente il pulsante `Edit`, adattandosi alla struttura annidata corrente.

## [1.0.13] - 2026-09-29

### Fixed

- Il pulsante `Edit` viene cercato esclusivamente nella sezione `Your Synonyms`, evitando gli altri controlli omonimi della pagina Learn.

## [1.0.12] - 2026-09-29

### Fixed

- Riconoscimento dei pulsanti a icona di Bunpro tramite `aria-label`, incluso il controllo `Edit` dell'editor sinonimi.

## [1.0.11] - 2026-09-29

### Changed

- Le note contengono soltanto il testo tradotto, senza i prefissi visibili `RIEPILOGO BUNPRO` o `RIEPILOGO GRAMMATICALE`.
- Le note generate vengono registrate internamente per poterle aggiornare senza modificare quelle personali; i vecchi prefissi vengono rimossi automaticamente.

## [1.0.10] - 2026-09-29

### Fixed

- La richiesta combinata Learn usa una sola coppia di marcatori, compatibile con Chrome quando omette i blocchi marcati successivi.
- Il sinonimo viene estratto per primo e il riepilogo dalla parte restante della stessa traduzione.

## [1.0.9] - 2026-09-29

### Fixed

- Riepilogo e sinonimi di una voce Learn vengono tradotti in un'unica richiesta locale, evitando il blocco osservato sulla seconda chiamata consecutiva della Translator API.
- Estrazione atomica tramite marcatori delle traduzioni destinate a Notes e Your Synonyms.

## [1.0.8] - 2026-09-29

### Fixed

- Una sola sessione Translator viene riutilizzata per pagina e le richieste sono serializzate.
- Ripristino automatico della sessione locale in caso di timeout o errore.

## [1.0.7] - 2026-09-29

### Fixed

- La traduzione dei sinonimi usa il Summary della voce come contesto, evitando richieste locali troppo brevi.

## [1.0.6] - 2026-09-29

### Fixed

- Workaround locale con marcatori per le versioni di Chrome che bloccano la Translator API sugli input di una sola parola.

## [1.0.5] - 2026-09-29

### Fixed

- I sinonimi usano sessioni di traduzione isolate e la stessa cache affidabile impiegata da Review.

## [1.0.4] - 2026-09-29

### Fixed

- La traduzione Review viene eseguita soltanto su `/reviews`, senza elaborare in massa gli esempi delle pagine Learn.
- Le note vengono elaborate prima dei sinonimi, mantenendo indipendenti le due funzioni.

## [1.0.3] - 2026-09-29

### Fixed

- Le note contengono soltanto il Summary o la spiegazione iniziale, senza le definizioni e gli esempi successivi.
- Normalizzazione delle parole brevi prima della traduzione locale.
- Aggiornamento sicuro delle sole note riconoscibili come generate dall'estensione.

## [1.0.2] - 2026-09-29

### Fixed

- Supporto al nuovo editor inline dei sinonimi Bunpro con i controlli `Edit`, `Add Synonym` e `Save Changes`.
- Riconoscimento dei sinonimi esistenti direttamente dai campi dell'editor.

## [1.0.1] - 2026-09-29

### Fixed

- Timeout e tentativi successivi quando la Translator API locale resta in attesa.
- Sinonimi e note vengono elaborati separatamente: un errore non blocca l'altra funzione.

## [1.0.0] - 2026-09-29

### Added

- Sinonimi italiani automatici per i vocaboli in Learn.
- Traduzione di Bunpro Summary e delle spiegazioni grammaticali nelle note.
- Traduzione locale delle frasi in Review.
- Tooltip con la frase inglese originale al passaggio del mouse.
- Popup con controlli separati per ogni funzione.
