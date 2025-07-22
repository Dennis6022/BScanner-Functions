const { onCall } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { defineSecret } = require("firebase-functions/params");
const OpenAI = require("openai");

// Firebase initialisieren
initializeApp();

// 🔐 Secrets für den OpenAI API-Schlüssel und die Organisations-ID definieren
const openaiApiKey = defineSecret("OPENAI_API_KEY");
const openaiOrgId = defineSecret("OPENAI_ORG_ID");

/**
 * Firebase Callable Cloud Function, die OpenAI mit dem gpt-3.5-turbo Modell verwendet.
 */
exports.getBarcodeMeaning = onCall(
  {
    // Die Region wird auf den ursprünglichen Wert zurückgesetzt.
    region: "europe-west1",
    secrets: [openaiApiKey, openaiOrgId],
  },
  async (request) => {
    
    // OpenAI-Client initialisieren
    const openai = new OpenAI({
      apiKey: openaiApiKey.value(),
      organization: openaiOrgId.value(),
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

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
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
      throw new Error("Die KI konnte nicht erreicht werden. Bitte versuchen Sie es später erneut.");
    }
  }
);
