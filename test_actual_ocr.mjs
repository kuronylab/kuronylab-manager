import Tesseract from 'tesseract.js';
import fs from 'fs';

async function main() {
    const imgPath = '/Users/kurokikouki2/.gemini/antigravity/brain/16117f16-b74c-4586-b591-874f84478ec5/media__1772951562337.png';
    const buf = fs.readFileSync(imgPath);
    
    console.log("Starting OCR on previous image...");
    const result = await Tesseract.recognize(
        buf,
        'jpn'
    );
    console.log("=== OCR TEXT ===");
    console.log(result.data.text);
    console.log("================");
}

main().catch(console.error);
