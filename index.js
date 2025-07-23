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
 * Firebase Callable Cloud Function, die OpenAI mit dem gpt-4o-mini Modell verwendet.
 */
exports.getBarcodeMeaning = onCall(
  {
    region: "europe-west1",
    secrets: [openaiApiKey, openaiOrgId],
  },
  async (request) => {
    
    const openai = new OpenAI({
      apiKey: openaiApiKey.value().trim(),
      organization: openaiOrgId.value().trim(),
    });

    // Zusätzliche Daten aus der Anfrage auslesen
    const barcode = request.data.barcode;
    // KORREKTUR: Parameter optional machen, um alte App-Versionen zu unterstützen
    const barcodeFormat = request.data.barcodeFormat; // Kann jetzt undefined sein
    const productTitle = request.data.productTitle; // Ist bereits optional
    const deviceLanguage = request.data.language || "en";

    // KORREKTUR: Nur noch prüfen, ob der Barcode vorhanden ist.
    if (!barcode) {
      logger.error("Anfrage ohne Barcode erhalten.");
      throw new Error("Fehler: Die Anfrage muss einen 'barcode'-Wert enthalten.");
    }

    logger.info(`Anfrage für Barcode ${barcode} erhalten. Sprache: ${deviceLanguage}`);

    try {
      // KORREKTUR: Der Prompt wird jetzt dynamisch zusammengebaut.
      // So funktioniert er auch, wenn barcodeFormat oder productTitle fehlen.
      let promptText = `Gib eine kurze, präzise Beschreibung für den Barcode '${barcode}'.`;

      if (barcodeFormat) {
        promptText += ` Der Typ des Barcodes ist '${barcodeFormat}'.`;
      }
      if (productTitle) {
        promptText += ` Der bekannte Titel des Produkts ist "${productTitle}".`;
      }

      promptText += ` Wenn es ein Produktcode ist (z.B. EAN oder UPC), beschreibe das Produkt und den Hersteller. Wenn es ein QR-Code ist, erkläre den Inhalt (z.B. URL, Text, Kontakt). WICHTIG: Antworte ausschließlich in der folgenden Sprache: ${deviceLanguage}.`;


      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Intelligentes und kostengünstiges Modell
        max_tokens: 250,
        messages: [
          {
            role: "system",
            content: "Du bist ein präziser und hilfreicher Assistent, der Barcode-Informationen basierend auf den verfügbaren Details in der vom Benutzer gewünschten Sprache liefert."
          },
          {
            role: "user",
            content: promptText
          }
        ],
      });

      const text = completion.choices[0].message.content.trim();
      
      if (text) {
        logger.info(`Antwort von OpenAI erfolgreich erhalten.`);
        return { result: text };
      } else {
        logger.warn(`OpenAI hat eine leere Antwort für Barcode ${barcode} zurückgegeben.`);
        return { result: null };
      }

    } catch (error) {
      logger.error("Fehler bei der Kommunikation mit der OpenAI API:", error);
      throw new Error("Die KI konnte nicht erreicht werden. Bitte versuchen Sie es später erneut.");
    }
  }
);
