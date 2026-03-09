function parseDateRobust(text) {
    let date = null;
    const normalizedText = text.replace(/\s+/g, '');
    const textForDate = normalizedText.replace(/[OoＯｏ]/g, '0').replace(/[lI|ｌＩ]/g, '1');
    
    // YYYY 1-3 non-digits, MM 1-3 non-digits, DD
    const dateRegex = /(?:20\d{2}[^\d]{1,3}\d{1,2}[^\d]{1,3}\d{1,2}|令和\d{1,2}[^\d]{1,3}\d{1,2}[^\d]{1,3}\d{1,2})/g;
    const dateMatches = textForDate.match(dateRegex);
    
    if (dateMatches && dateMatches.length > 0) {
        let dStr = dateMatches[0];
        console.log("Matched dStr:", dStr);
        if (dStr.includes('令和')) {
            const reiwaMatch = dStr.match(/令和(\d{1,2})[^\d]+(\d{1,2})[^\d]+(\d{1,2})/);
            if (reiwaMatch) {
                const year = 2018 + parseInt(reiwaMatch[1]);
                const month = reiwaMatch[2].padStart(2, '0');
                const day = reiwaMatch[3].padStart(2, '0');
                date = `${year}-${month}-${day}`;
            }
        } else {
            const numRegex = /(\d{4})[^\d]+(\d{1,2})[^\d]+(\d{1,2})/;
            const m = dStr.match(numRegex);
            if (m) {
                const year = m[1];
                const month = m[2].padStart(2, '0');
                const day = m[3].padStart(2, '0');
                date = `${year}-${month}-${day}`;
            }
        }
    }
    return date;
}

const tests = [
    "請求日:2026年1月13日",
    "2026和1月13E",
    "2026/01/13",
    "令和5年2月10日",
    "2026ー01ー13",
    "請求日:2026.1,13",
    "2026年 1月 13日" // but normalized removes spaces
];

for (const t of tests) {
    console.log(`${t} ->`, parseDateRobust(t));
}

