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
    const barcodeFormat = request.data.barcodeFormat; // z.B. "EAN_13", "QR_CODE"
    const productTitle = request.data.productTitle; // Optionaler Titel, kann null sein
    const deviceLanguage = request.data.language || "en";

    if (!barcode || !barcodeFormat) {
      logger.error("Anfrage ohne Barcode oder Barcode-Format erhalten.");
      throw new Error("Fehler: Die Anfrage muss 'barcode' und 'barcodeFormat' enthalten.");
    }

    logger.info(`Anfrage für Barcode ${barcode} (Format: ${barcodeFormat}) erhalten. Sprache: ${deviceLanguage}`);

    try {
      // Der Prompt ist jetzt viel detaillierter und intelligenter.
      const titleHint = productTitle ? ` Der bekannte Titel des Produkts ist "${productTitle}".` : '';
      const promptText = `Gib eine kurze, präzise Beschreibung für den Barcode '${barcode}'. Der Typ des Barcodes ist '${barcodeFormat}'.${titleHint} Wenn es ein Produktcode ist (z.B. EAN oder UPC), beschreibe das Produkt und den Hersteller. Wenn es ein QR-Code ist, erkläre den Inhalt (z.B. URL, Text, Kontakt). WICHTIG: Antworte ausschließlich in der folgenden Sprache: ${deviceLanguage}.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Intelligentes und kostengünstiges Modell
        max_tokens: 250,
        messages: [
          {
            role: "system",
            content: "Du bist ein präziser und hilfreicher Assistent, der Barcode-Informationen basierend auf dem Wert, Typ und optionalen Produkttitel in der vom Benutzer gewünschten Sprache liefert."
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
