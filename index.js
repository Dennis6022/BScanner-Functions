// Dies ist ein Test-Kommentar, um eine erneute Bereitstellung zu erzwingen.
const { onCall } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
// Import der Google Generative AI Bibliothek auskommentiert
// const { GoogleGenerativeAI } = require("@google/generative-ai"); 
const OpenAI = require("openai"); // Import der OpenAI Bibliothek

initializeApp();

// Initialisiere das KI-Modell mit dem API-Schlüssel aus den Secrets
// Die Initialisierung für Google Generative AI ist auskommentiert
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Verwende den OpenAI API-Schlüssel
});

exports.getBarcodeMeaning = onCall({ region: "europe-west1" }, async (request) => {
    const barcode = request.data.barcode;
    // Sprache vom Gerät abrufen; Standard ist Deutsch, wenn keine Sprache gesendet wird
    const language = request.data.language || "de"; 

    if (!barcode) {
        logger.error("Anfrage ohne Barcode erhalten.");
        throw new Error("Fehler: Die Anfrage muss einen 'barcode'-Wert enthalten.");
    }

    logger.info(`Anfrage für Barcode erhalten: ${barcode} in Sprache: ${language}`);

    try {
        // Prompt anpassen, um die Antwort in der gewünschten Sprache anzufordern
        let promptLanguageInstruction = '';
        switch (language.toLowerCase()) {
            case 'de':
                promptLanguageInstruction = 'Antworte auf Deutsch.';
                break;
            case 'en':
                promptLanguageInstruction = 'Answer in English.';
                break;
            case 'es':
                promptLanguageInstruction = 'Responde en español.';
                break;
            case 'fr':
                promptLanguageInstruction = 'Réponds en français.';
                break;
            case 'it':
                promptLanguageInstruction = 'Rispondi in italiano.';
                break;
            default:
                promptLanguageInstruction = 'Antworte auf Deutsch.'; // Fallback auf Deutsch
        }

        const promptText = `Was bedeutet der Barcode '${barcode}'? Wenn es ein Produktcode (wie EAN oder UPC) ist, beschreibe das Produkt und den Hersteller kurz. ${promptLanguageInstruction}`;

        // Aufruf der OpenAI API für Chat Completions
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo", // Das verwendete Modell
            messages: [
                { role: "system", content: "Du bist ein hilfreicher Assistent, der Barcode-Informationen liefert." },
                { role: "user", content: promptText }
            ],
            max_tokens: 150, // Begrenzung der Antwortlänge
        });

        const text = completion.choices[0].message.content;

        logger.info(`KI-Antwort erhalten: ${text}`);
        return { result: text };

    } catch (error) {
        // Fehlerbehandlung für die OpenAI API
        logger.error("Fehler bei der OpenAI API:", error);
        throw new Error("Fehler bei der Kommunikation mit der KI.");
    }
});
