const { onCall } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { defineSecret } = require("firebase-functions/params");
const OpenAI = require("openai"); // OpenAI-Bibliothek importieren

// Firebase initialisieren
initializeApp();

// 🔐 Secret für den OpenAI API-Schlüssel definieren
const openaiApiKey = defineSecret("OPENAI_API_KEY");

/**
 * Firebase Callable Cloud Function, die OpenAI mit dem gpt-4o-mini Modell verwendet.
 */
exports.getBarcodeMeaning = onCall(
  {
    region: "europe-west1",
    secrets: [openaiApiKey], // Das OpenAI-Secret für die Funktion verfügbar machen
  },
  async (request) => {
    // OpenAI-Client initialisieren
    const openai = new OpenAI({
      apiKey: openaiApiKey.value(),
    });

    const barcode = request.data.barcode;
    const language = request.data.language || "de";

    if (!barcode) {
      logger.error("Anfrage ohne Barcode erhalten.");
      throw new Error("Fehler: Die Anfrage muss einen 'barcode'-Wert enthalten.");
    }

    logger.info(`Anfrage für Barcode ${barcode} an OpenAI wird gesendet...`);

    try {
      const promptText = `Was bedeutet der Barcode '${barcode}'? Wenn es ein Produktcode (wie EAN oder UPC) ist, beschreibe das Produkt und den Hersteller kurz. Antworte in der Sprache: ${language}.`;

      // API-Aufruf an OpenAI mit dem korrekten Chat-Completions-Endpunkt
      const completion = await openai.chat.completions.create({
        // gpt-4o-mini: Schnell, intelligent und sehr kostengünstig für Tier-1-Nutzer.
        model: "gpt-4o-mini",
        max_tokens: 200,
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
      });

      const text = completion.choices[0].message.content.trim();
      logger.info(`Antwort von OpenAI erfolgreich erhalten.`);
      
      return { result: text };

    } catch (error) {
      logger.error("Fehler bei der Kommunikation mit der OpenAI API:", error);
      // Dieser Fehler sollte jetzt nicht mehr auftreten, wenn der Schlüssel und das Guthaben korrekt sind.
      throw new Error("Die KI konnte nicht erreicht werden. Bitte versuchen Sie es später erneut.");
    }
  }
);
