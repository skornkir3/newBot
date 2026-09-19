function normalizeText(text = "") {
    return String(text)
        .normalize("NFKC")
        .replace(/\r/g, "")
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .trim();
}

function parseDate(text) {
    // Ловим:
    // 03.03
    // 03.03.26
    // 03.03.2026
    const match = text.match(/\b(\d{2})\.(\d{2})(?:\.(\d{2}|\d{4}))?\b/);
    if (!match) return null;

    const day = Number(match[1]);
    const month = Number(match[2]);
    let year;

    if (!match[3]) {
        year = new Date().getFullYear();
    } else if (match[3].length === 2) {
        year = 2000 + Number(match[3]);
    } else {
        year = Number(match[3]);
    }

    if (!day || !month || month < 1 || month > 12 || day < 1 || day > 31) {
        return null;
    }

    return { day, month, year };
}

function parseTime(text) {
    const match = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (!match) return null;

    return {
        hours: Number(match[1]),
        minutes: Number(match[2]),
    };
}

function parseMaps(text) {
    const match = text.match(/maps?\s*:\s*([^\n]+)/i);
    if (!match) return [];

    const raw = match[1]
        .split("/")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

    const mapDict = {
        era: "Эрангель",
        erangel: "Эрангель",
        er: "Эрангель",

        ron: "Рондо",
        rondo: "Рондо",

        mir: "Мирамар",
        miramar: "Мирамар",

        liv: "Ливик",
        livik: "Ливик",

        san: "Санок",
        sanhok: "Санок",

        vik: "Викенди",
        vikendi: "Викенди",

        kar: "Каракин",
        karakin: "Каракин",

        nusa: "Нуса",
    };

    return raw.map((item) => mapDict[item] || item);
}

function buildStartDate(dateObj, timeObj) {
    if (!dateObj || !timeObj) return null;

    const dt = new Date(
        dateObj.year,
        dateObj.month - 1,
        dateObj.day,
        timeObj.hours,
        timeObj.minutes,
        0,
        0
    );

    if (Number.isNaN(dt.getTime())) return null;
    return dt;
}

function parseTournamentPost(inputText = "") {
    const text = normalizeText(inputText);

    const dateObj = parseDate(text);
    const timeObj = parseTime(text);
    const maps = parseMaps(text); // если не найдены — вернется []
    const startAt = buildStartDate(dateObj, timeObj);

    return {
        rawText: text,
        dateObj,
        timeObj,
        maps,
        startAt,
    };
}

module.exports = {
    parseTournamentPost,
};