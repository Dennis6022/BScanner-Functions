// Dies ist ein Test-Kommentar, um eine erneute Bereitstellung zu erzwingen.
const { onCall } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { defineSecret } = require("firebase-functions/params");
const OpenAI = require("openai");

// Firebase initialisieren
initializeApp();

// 🔐 Secret definieren – muss über CLI oder GitHub Actions gesetzt sein
const openaiApiKey = defineSecret("OPENAI_API_KEY");

/**
 * Firebase Callable Cloud Function zum Abrufen der Bedeutung eines Barcodes.
 * Diese Funktion empfängt einen Barcode und eine gewünschte Sprache vom Client.
 * Sie ruft dann die OpenAI API auf, um Informationen zum Barcode zu erhalten,
 * und gibt die Antwort in der erkannten Sprache zurück.
 */
exports.getBarcodeMeaning = onCall(
  {
    region: "europe-west1",
    secrets: [openaiApiKey], // Secret wird bei Funktionsstart bereitgestellt
  },
  async (request) => {
    // OpenAI-Client initialisieren zur Laufzeit mit Secret-Wert
    const openai = new OpenAI({
      apiKey: openaiApiKey.value(),
    });

    const barcode = request.data.barcode;
    const language = request.data.language || "de";

    if (!barcode) {
      logger.error("Anfrage ohne Barcode erhalten.");
      throw new Error("Fehler: Die Anfrage muss einen 'barcode'-Wert enthalten.");
    }

    logger.info(`Anfrage für Barcode erhalten: ${barcode} in Sprache: ${language}`);

    try {
      const promptText = `Was bedeutet der Barcode '${barcode}'? Wenn es ein Produktcode (wie EAN oder UPC) ist, beschreibe das Produkt und den Hersteller kurz.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "Du bist ein hilfreicher Assistent, der Barcode-Informationen liefert." },
          { role: "user", content: promptText }
        ],
        max_tokens: 150,
      });

      const text = completion.choices[0].message.content;
      logger.info(`KI-Antwort erhalten: ${text}`);
      return { result: text };

    } catch (error) {
      logger.error("Fehler bei der OpenAI API:", error);
      throw new Error("Fehler bei der Kommunikation mit der KI.");
    }
  }
);
