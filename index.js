// Dies ist ein Test-Kommentar, um eine erneute Bereitstellung zu erzwingen.
const { onCall } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const OpenAI = require("openai"); // Import der OpenAI Bibliothek

initializeApp();

// Initialisiere den OpenAI-Client mit dem API-Schlüssel, der als Umgebungsvariable übergeben wird.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Der API-Schlüssel wird aus den GitHub Secrets geladen.
});

/**
 * Firebase Callable Cloud Function zum Abrufen der Bedeutung eines Barcodes.
 * Diese Funktion empfängt einen Barcode und eine gewünschte Sprache vom Client.
 * Sie ruft dann die OpenAI API auf, um Informationen zum Barcode zu erhalten,
 * und gibt die Antwort in der erkannten Sprache zurück.
 */
exports.getBarcodeMeaning = onCall({ region: "europe-west1" }, async (request) => {
    // Extrahiere den Barcode aus den Anfragedaten.
    const barcode = request.data.barcode;
    // Extrahiere die gewünschte Sprache aus den Anfragedaten.
    // Wenn keine Sprache gesendet wird, wird standardmäßig 'de' (Deutsch) verwendet.
    const language = request.data.language || "de"; 

    // Überprüfe, ob ein Barcode in der Anfrage enthalten ist.
    if (!barcode) {
        logger.error("Anfrage ohne Barcode erhalten.");
        // Werfe einen Fehler, der an den Client zurückgegeben wird.
        throw new Error("Fehler: Die Anfrage muss einen 'barcode'-Wert enthalten.");
    }

    // Protokolliere die erhaltene Anfrage für Debugging-Zwecke.
    logger.info(`Anfrage für Barcode erhalten: ${barcode} in Sprache: ${language}`);

    try {
        // Der Prompt wird jetzt ohne explizite Sprachanweisung formuliert.
        // Die KI soll die Sprache aus dem Kontext des Prompts erkennen und entsprechend antworten.
        const promptText = `Was bedeutet der Barcode '${barcode}'? Wenn es ein Produktcode (wie EAN oder UPC) ist, beschreibe das Produkt und den Hersteller kurz.`;

        // Rufe die OpenAI Chat Completions API auf.
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo", // Das verwendete OpenAI-Modell.
            messages: [
                // System-Nachricht definiert die Rolle des Assistenten.
                // Hier ist der System-Prompt allgemeiner gehalten. Die KI wird die Sprache der Benutzeranfrage erkennen.
                { role: "system", content: "Du bist ein hilfreicher Assistent, der Barcode-Informationen liefert." },
                // Benutzer-Nachricht enthält die eigentliche Frage mit dem Barcode.
                { role: "user", content: promptText }
            ],
            max_tokens: 150, // Begrenzung der maximalen Länge der generierten Antwort.
        });

        // Extrahiere den generierten Text aus der OpenAI-Antwort.
        const text = completion.choices[0].message.content;

        // Protokolliere die von der KI erhaltene Antwort.
        logger.info(`KI-Antwort erhalten: ${text}`);
        // Gebe das Ergebnis an den aufrufenden Client zurück.
        return { result: text };

    } catch (error) {
        // Fange Fehler ab, die während der Kommunikation mit der OpenAI API auftreten.
        logger.error("Fehler bei der OpenAI API:", error);
        // Werfe einen generischen Fehler an den Client zurück, um sensible API-Fehler zu verbergen.
        throw new Error("Fehler bei der Kommunikation mit der KI.");
    }
});
