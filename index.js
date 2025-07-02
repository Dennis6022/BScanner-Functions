const { onCall } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { GoogleGenerativeAI } = require("@google/generative-ai");

initializeApp();

// Initialisiere das KI-Modell mit dem API-Schlüssel aus den Secrets
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.getBarcodeMeaning = onCall({ region: "europe-west1" }, async (request) => {
    const barcode = request.data.barcode;
    if (!barcode) {
        logger.error("Anfrage ohne Barcode erhalten.");
        throw new Error("Fehler: Die Anfrage muss einen 'barcode'-Wert enthalten.");
    }

    logger.info(`Anfrage für Barcode erhalten: ${barcode}`);

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});
    const prompt = `Was bedeutet der Barcode '${barcode}'? Wenn es ein Produktcode (wie EAN oder UPC) ist, beschreibe das Produkt und den Hersteller kurz. Antworte auf Deutsch.`;

    try {
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        logger.info(`KI-Antwort erhalten: ${text}`);
        return { result: text };

    } catch (error) {
        logger.error("Fehler bei der Gemini API:", error);
        throw new Error("Fehler bei der Kommunikation mit der KI.");
    }
});
