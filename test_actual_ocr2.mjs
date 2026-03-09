import Tesseract from 'tesseract.js';
import fs from 'fs';

async function main() {
    const imgPath = '/Users/kurokikouki2/.gemini/antigravity/brain/16117f16-b74c-4586-b591-874f84478ec5/media__1772951868920.png';
    const buf = fs.readFileSync(imgPath);
    
    console.log("Starting OCR on the uploaded image with eng+jpn...");
    const result = await Tesseract.recognize(
        buf,
        'eng+jpn'
    );
    console.log("=== OCR TEXT ===");
    console.log(result.data.text);
    console.log("================");
}

main().catch(console.error);
