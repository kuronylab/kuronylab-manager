import Tesseract from 'tesseract.js';
import fs from 'fs';
import { createCanvas, loadImage } from 'canvas';

function parseReceiptText(text) {
    // OCR特有の変な空白を除去した正規化テキスト
    const normalizedText = text.replace(/\s+/g, '');
    const lines = text.split('\n').filter(l => l.trim().length > 0);

    let date = null;
    let amount = null;
    let description = null;

    // --- 日付の推測 ---
    // 日付探索用に、誤読されやすい文字（O -> 0, l/I/| -> 1）を置換し、ピリオド等も許容する
    const textForDate = normalizedText.replace(/[OoＯｏ]/g, '0').replace(/[lI|ｌＩ]/g, '1');
    const dateRegex = /(?:20\d{2}[年\/\-\.]{1,2}\d{1,2}[月\/\-\.]{1,2}\d{1,2}日?|令和\d{1,2}[年\/\-\.]{1,2}\d{1,2}[月\/\-\.]{1,2}\d{1,2}日?)/g;
    const dateMatches = textForDate.match(dateRegex);
    
    if (dateMatches && dateMatches.length > 0) {
        let dStr = dateMatches[0];
        if (dStr.includes('令和')) {
            const reiwaMatch = dStr.match(/令和(\d{1,2})[年\/\-\.]+(\d{1,2})[月\/\-\.]+(\d{1,2})/);
            if (reiwaMatch) {
                const year = 2018 + parseInt(reiwaMatch[1]);
                const month = reiwaMatch[2].padStart(2, '0');
                const day = reiwaMatch[3].padStart(2, '0');
                date = `${year}-${month}-${day}`;
            }
        } else {
            const numRegex = /(\d{4})[年\/\-\.]+(\d{1,2})[月\/\-\.]+(\d{1,2})/;
            const m = dStr.match(numRegex);
            console.log("m:", m);
            if (m) {
                const year = m[1];
                const month = m[2].padStart(2, '0');
                const day = m[3].padStart(2, '0');
                date = `${year}-${month}-${day}`;
            }
        }
    }
    
    return { date };
}

async function main() {
    const imgPath = '/Users/kurokikouki2/.gemini/antigravity/brain/16117f16-b74c-4586-b591-874f84478ec5/media__1772951868920.png';
    console.log("Loading image...");
    const image = await loadImage(imgPath);
    
    // Scale 2x
    const canvas = createCanvas(image.width * 2, image.height * 2);
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    console.log("Running OCR on 2x scaled image...");
    const result = await Tesseract.recognize(
        canvas.toBuffer('image/png'),
        'jpn'
    );
    const text = result.data.text;
    console.log("=== OCR TEXT ===");
    console.log(text);
    console.log("================");
    
    console.log("\nParsing...");
    const parsed = parseReceiptText(text);
    console.log("Parsed Result:", parsed);
}

main().catch(console.error);
