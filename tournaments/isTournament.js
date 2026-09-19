function isTournamentPost(text = "") {
    const normalized = String(text).normalize("NFKC").toLowerCase();

    const hasDate = /\b\d{2}\.\d{2}(?:\.\d{2,4})?\b/.test(normalized);
    console.log("hasDate:", hasDate);

    const hasTime = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.test(normalized);
    console.log("hasTime:", hasTime);

    const hasMaps = /maps?\s*:/.test(normalized);
    console.log("hasMaps:", hasMaps);

    const hasMode = normalized.includes("practical games") || normalized.includes('practice games') || normalized.includes("custom games");
    console.log("hasMode:", hasMode);

    return hasDate && hasTime && hasMode;
}

module.exports = isTournamentPost;

