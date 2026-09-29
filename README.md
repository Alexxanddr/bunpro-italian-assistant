# Bunpro Italian Assistant

Estensione Chrome per studiare Bunpro in italiano. Unisce in un solo progetto le traduzioni delle schermate **Learn** e **Review**, senza servizi o chiavi API esterni.

## Funzionalità

### Learn

- Traduce i significati dei vocaboli e li salva in **Your Synonyms**.
- Evita sinonimi duplicati e gestisce significati multipli separati da virgole.
- Traduce **Bunpro Summary** e lo salva nelle note.
- Per la grammatica, traduce la spiegazione **About…** nelle note.
- Non sovrascrive note personali già presenti.
- Se una schermata Grammar non offre l'editor dei sinonimi, continua senza errori.

### Review

- Sostituisce la frase inglese con la traduzione italiana.
- Conserva grassetti e parti evidenziate quando possibile.
- Mostra la frase originale inglese passando il mouse sulla traduzione.
- Rileva automaticamente le nuove domande senza richiedere refresh.

## Traduzione e privacy

La traduzione usa la [Translator API integrata in Chrome](https://developer.chrome.com/docs/ai/translator-api). Il testo viene elaborato localmente: non servono account aggiuntivi, chiavi API o servizi a pagamento.

L'estensione:

- funziona soltanto su `bunpro.jp`;
- non raccoglie dati e non usa analytics;
- salva in `chrome.storage.sync` soltanto gli interruttori del popup;
- modifica note e sinonimi esclusivamente tramite l'interfaccia Bunpro.

## Requisiti

- Google Chrome desktop 138 o successivo.
- Un account Bunpro.
- Accesso alle pagine `bunpro.jp`.

Al primo utilizzo Chrome potrebbe impiegare alcuni secondi per scaricare il pacchetto linguistico inglese→italiano.

## Installazione manuale

1. Scarica lo ZIP dall'ultima [Release](../../releases/latest) e decomprimilo.
2. Apri `chrome://extensions`.
3. Attiva **Modalità sviluppatore**.
4. Premi **Carica estensione non pacchettizzata**.
5. Seleziona la cartella estratta che contiene `manifest.json`.
6. Disattiva eventuali vecchie estensioni Bunpro di traduzione per evitare conflitti.
7. Ricarica Bunpro.

## Impostazioni

Dal popup puoi controllare separatamente:

- l'intera estensione;
- i sinonimi italiani in Learn;
- le traduzioni nelle note di Learn;
- le frasi italiane in Review.

## Sviluppo

Il progetto usa Manifest V3 e non richiede dipendenze né build.

```bash
node --check content.js
node --check popup.js
python3 -m json.tool manifest.json >/dev/null
```

Per creare lo ZIP:

```bash
./scripts/package.sh
```

## Contributi e sicurezza

Leggi [CONTRIBUTING.md](CONTRIBUTING.md) per proporre modifiche e [SECURITY.md](SECURITY.md) per segnalare vulnerabilità.

## Licenza

Distribuito con licenza [MIT](LICENSE). Il progetto non è affiliato, sponsorizzato o approvato da Bunpro.
