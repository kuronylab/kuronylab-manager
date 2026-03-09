import Tesseract from 'tesseract.js';
import fs from 'fs';
import { createCanvas, loadImage } from 'canvas';

async function main() {
    const imgPath = '/Users/kurokikouki2/.gemini/antigravity/brain/16117f16-b74c-4586-b591-874f84478ec5/media__1772951868920.png';
    console.log("Loading image...");
    const image = await loadImage(imgPath);
    
    // Scale 2x
    const canvas = createCanvas(image.width * 2, image.height * 2);
    const ctx = canvas.getContext('2d');
    
    // Optional: draw white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    
    console.log("Running OCR on 2x scaled image...");
    const result = await Tesseract.recognize(
        canvas.toBuffer('image/png'),
        'jpn'
    );
    console.log("=== OCR TEXT ===");
    console.log(result.data.text);
}

main().catch(console.error);
