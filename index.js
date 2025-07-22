// Dies ist ein Test-Kommentar, um eine erneute Bereitstellung zu erzwingen.
const { onCall } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { defineSecret } = require("firebase-functions/params");
const OpenAI = require("openai");

// Firebase initialisieren
initializeApp();

// 🔐 Secret für den OpenAI API-Schlüssel definieren.
// Dieser Wert muss in der Google Cloud Secret Manager Konsole gesetzt werden.
const openaiApiKey = defineSecret("OPENAI_API_KEY");

/**
 * Firebase Callable Cloud Function zum Abrufen der Bedeutung eines Barcodes.
 * Diese Funktion nutzt das gpt-4o-mini Modell für eine schnelle und kostengünstige Antwort.
 */
exports.getBarcodeMeaning = onCall(
  {
    region: "europe-west1", // Region für die Funktion
    secrets: [openaiApiKey],   // Macht das Secret für die Funktion verfügbar
  },
  async (request) => {
    // OpenAI-Client initialisieren. Dies geschieht zur Laufzeit,
    // damit der Wert des Secrets sicher geladen wird.
    const openai = new OpenAI({
      apiKey: openaiApiKey.value(),
      maxRetries: 2,      // Versucht bei vorübergehenden Fehlern (wie Rate Limits) die Anfrage bis zu 2 Mal erneut.
      timeout: 20 * 1000, // Bricht die Anfrage nach 20 Sekunden ab, um Endlosschleifen zu verhindern.
    });

    // Daten aus der Client-Anfrage extrahieren
    const barcode = request.data.barcode;
    const language = request.data.language || "de"; // Standardmäßig Deutsch, falls keine Sprache angegeben

    // Überprüfen, ob ein Barcode mitgesendet wurde
    if (!barcode) {
      logger.error("Anfrage ohne Barcode erhalten.");
      // Wirft einen Fehler, der an den Client zurückgesendet wird.
      throw new Error("Fehler: Die Anfrage muss einen 'barcode'-Wert enthalten.");
    }

    logger.info(`Anfrage für Barcode erhalten: ${barcode} in Sprache: ${language}`);

    try {
      // Der Prompt, der an die KI gesendet wird.
      const promptText = `Was bedeutet der Barcode '${barcode}'? Wenn es ein Produktcode (wie EAN oder UPC) ist, beschreibe das Produkt und den Hersteller kurz. Antworte in der Sprache: ${language}.`;

      // API-Aufruf an OpenAI mit dem Chat-Completions-Endpunkt
      const completion = await openai.chat.completions.create({
        // OPTIMIERT: gpt-4o-mini ist das beste Modell für Tier 1: schnell, intelligent und sehr günstig.
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Du bist ein präziser und hilfreicher Assistent, der Barcode-Informationen in der vom Benutzer gewünschten Sprache liefert."
          },
          {
            role: "user",
            content: promptText
          }
        ],
        max_tokens: 200, // Leicht erhöhtes Token-Limit für detailliertere Antworten
      });

      // Die Textantwort aus dem ersten Choice-Objekt extrahieren
      const text = completion.choices[0].message.content.trim();
      logger.info(`KI-Antwort erfolgreich erhalten für Barcode: ${barcode}`);
      
      // Erfolgreiches Ergebnis an den Client zurückgeben
      return { result: text };

    } catch (error) {
      // Detailliertes Logging des Fehlers auf dem Server für die Fehlersuche
      logger.error("Fehler bei der Kommunikation mit der OpenAI API:", error);
      
      // Eine allgemeine, aber klare Fehlermeldung an den Client zurückgeben
      throw new Error("Die KI konnte nicht erreicht werden. Bitte versuchen Sie es später erneut.");
    }
  }
);
