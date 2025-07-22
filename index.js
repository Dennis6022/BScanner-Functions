const { onCall } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { defineSecret } = require("firebase-functions/params");
const OpenAI = require("openai");
const axios = require("axios"); // Hinzugefügt für den Netzwerktest

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
    // LETZTER LÖSUNGSVERSUCH: Ändern der Region.
    // Manchmal gibt es Netzwerkprobleme, die spezifisch für eine Region sind.
    // Wir wechseln von europe-west1 zu us-central1, einer Hauptregion in den USA,
    // um mögliche Routing-Probleme zur OpenAI-API zu umgehen.
    region: "us-central1",
    secrets: [openaiApiKey, openaiOrgId],
  },
  async (request) => {
    
    // ================= START: ALLGEMEINER NETZWERK-DIAGNOSE-BLOCK =================
    try {
      logger.info("Teste allgemeine ausgehende Netzwerkverbindung zu https://www.google.com...");
      await axios.get('https://www.google.com');
      logger.info("Verbindung zu google.com erfolgreich. Allgemeine Netzwerkverbindung ist OK.");
    } catch (networkError) {
      logger.error("FATALER FEHLER: Verbindung zu google.com fehlgeschlagen. Ausgehender Netzwerkverkehr scheint blockiert zu sein.", networkError);
      throw new Error("Netzwerk-Konnektivitätstest fehlgeschlagen. Ausgehender Traffic ist blockiert.");
    }
    // ================== ENDE: ALLGEMEINER NETZWERK-DIAGNOSE-BLOCK ==================

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
