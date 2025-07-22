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
      // KORREKTUR: .trim() entfernt unsichtbare Leerzeichen oder Zeilenumbrüche vom Schlüssel.
      apiKey: openaiApiKey.value().trim(),
      organization: openaiOrgId.value().trim(),
    });

    const barcode = request.data.barcode;
    // NEU: Die Gerätesprache aus der Anfrage auslesen.
    // Ihre App muss diese als 'language' mitsenden (z.B. "en" für Englisch, "es" für Spanisch).
    // Wenn keine Sprache gesendet wird, wird Englisch als sicherer Standard verwendet.
    const deviceLanguage = request.data.language || "en";

    if (!barcode) {
      logger.error("Anfrage ohne Barcode erhalten.");
      throw new Error("Fehler: Die Anfrage muss einen 'barcode'-Wert enthalten.");
    }

    logger.info(`Anfrage für Barcode ${barcode} erhalten. Gewünschte Sprache: ${deviceLanguage}`);

    try {
      // NEU: Der Prompt wurde angepasst, um die Sprache expliziter zu machen.
      const promptText = `Gib eine kurze Beschreibung für den Barcode '${barcode}'. Wenn es ein Produktcode ist (z.B. EAN oder UPC), nenne das Produkt und den Hersteller. WICHTIG: Antworte ausschließlich in der folgenden Sprache: ${deviceLanguage}.`;

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
