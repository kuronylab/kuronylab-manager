import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

// Viteの機能を利用して worker をプロジェクト内から読み込む (CDNに依存しない)
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Tesseract.js を用いて画像からテキストを抽出する
 * @param {File} imageFile 
 * @returns {Promise<string>} 抽出されたテキスト
 */
export async function extractTextFromImage(imageFile) {
    try {
        // 画像を2倍に拡大してOCRの精度を上げる
        const img = new Image();
        const url = URL.createObjectURL(imageFile);

        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = url;
        });

        const canvas = document.createElement('canvas');
        const scale = 2.0;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');

        // 白背景を敷く（透過PNG等の認識漏れ対策）
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // スムージングを有効にして綺麗に拡大
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        URL.revokeObjectURL(url);

        const result = await Tesseract.recognize(
            blob,
            'jpn', // 日本語モデルを指定
            {
                logger: m => console.log(m) // 進行状況のロギング
            }
        );
        return result.data.text;
    } catch (error) {
        console.error("OCR Error:", error);
        throw new Error("画像の読み取りに失敗しました。");
    }
}

/**
 * PDFファイルからテキストを直接抽出する（テキストが含まれているPDFの場合）
 * @param {File} pdfFile
 * @returns {Promise<string>} 抽出されたテキスト
 */
export async function extractTextFromPDF(pdfFile) {
    try {
        const fileReader = new FileReader();

        const arrayBuffer = await new Promise((resolve, reject) => {
            fileReader.onload = () => resolve(fileReader.result);
            fileReader.onerror = () => reject(new Error("ファイルの読み込みに失敗しました"));
            fileReader.readAsArrayBuffer(pdfFile);
        });

        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdfDocument = await loadingTask.promise;
        const numPages = pdfDocument.numPages;

        let fullText = "";

        // 最初からテキスト抽出を試みる（最大3ページ）
        for (let i = 1; i <= Math.min(numPages, 3); i++) {
            const page = await pdfDocument.getPage(i);
            const textContent = await page.getTextContent();
            let pageText = "";
            let lastY = null;
            for (const item of textContent.items) {
                // Y座標が一定以上変わるか、EOLフラグがあれば改行とみなす
                if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
                    pageText += "\n";
                } else if (item.hasEOL) {
                    pageText += "\n";
                }
                pageText += item.str;
                lastY = item.transform[5];
            }
            fullText += pageText + "\n";
        }

        // --- フォールバック: テキストがほとんど取れない場合 (スキャンされたPDF) ---
        if (fullText.trim().length < 20) {
            console.log("PDF contains very little text. Falling back to OCR (Canvas Rendering)...");
            const firstPage = await pdfDocument.getPage(1);
            const viewport = firstPage.getViewport({ scale: 2.0 }); // 精度を上げるため 2倍でレンダリング
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await firstPage.render({ canvasContext: context, viewport: viewport }).promise;

            // CanvasをBlobにしてTesseractに渡す
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
            const ocrText = await extractTextFromImage(blob);
            fullText = ocrText;
        }

        return fullText;

    } catch (error) {
        console.error("PDF Extraction Error:", error);
        if (error.message.includes("Worker") || error.message.includes("worker")) {
            throw new Error("PDF解析エンジンの起動に失敗しました（Web Workerの読み込みエラー）。ブラウザ設定やオフライン状態を確認してください。");
        }
        throw new Error(error.message || "PDFからのテキスト抽出に失敗しました。");
    }
}

/**
 * 抽出されたテキストから日付、金額、摘要の候補を推測する
 * @param {string} text 抽出されたテキスト全体
 * @returns {Object} { date: string|null, amount: number|null, description: string|null }
 */
export function parseReceiptText(text) {
    // OCR特有の変な空白を除去した正規化テキスト
    const normalizedText = text.replace(/\s+/g, '');
    const lines = text.split('\n').filter(l => l.trim().length > 0);

    let date = null;
    let amount = null;
    let description = null;
    let partner = null; // 追加: 取引先項目の変数

    // --- 日付の推測 ---
    // 日付探索用に、誤読されやすい文字（O -> 0, l/I/| -> 1）を置換し、ピリオド等も許容する
    const textForDate = normalizedText.replace(/[OoＯｏ]/g, '0').replace(/[lI|ｌＩ]/g, '1');
    // 年・月・日の区切りがOCRで別の記号や漢字に誤読されるケースに備え、区切りを「数字以外の文字(1〜3文字)」と定義する強固な正規表現
    const dateRegex = /(?:20\d{2}[^\d]{1,3}\d{1,2}[^\d]{1,3}\d{1,2}|令和\d{1,2}[^\d]{1,3}\d{1,2}[^\d]{1,3}\d{1,2})/g;
    const dateMatches = textForDate.match(dateRegex);

    if (dateMatches && dateMatches.length > 0) {
        let dStr = dateMatches[0];
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

    // --- 金額の推測 ---
    const amountKeywords = ['ご請求金額', '合計金額', '支払額', '税込合計', '合計', '小計', '税込', '金額', 'TOTAL', 'Amount'];
    let possibleAmounts = [];

    for (let line of lines) {
        const normalizedLine = line.replace(/\s+/g, '');
        // 通貨記号や誤読(Y, V)を考慮。7 は数値の一部としての出現頻度が高いため通貨記号の誤読扱いから除外。
        const moneyRegex = /([¥￥YV]?[1-9]\d{0,2}(?:[,\.]\d{3})+|[¥￥YV]?[1-9]\d*|[1-9]\d{2,}円)/gi;

        let match;
        while ((match = moneyRegex.exec(normalizedLine)) !== null) {
            let rawStr = match[0];
            let valStr = rawStr.replace(/[¥￥YV,\.円]/gi, '');
            const val = parseInt(valStr, 10);

            if (!isNaN(val) && val > 0) {
                const isYearLike = val >= 2020 && val <= 2030;
                const hasCurrencyExplicit = /[¥￥円]/.test(rawStr);

                if (isYearLike && !hasCurrencyExplicit) continue;

                let weight = 0;
                if (amountKeywords.some(kw => normalizedLine.includes(kw))) weight += 15;
                if (normalizedLine.includes('ご請求金額') || normalizedLine.includes('合計金額')) weight += 20;
                if (hasCurrencyExplicit) weight += 5;

                possibleAmounts.push({ val: val, weight: weight, context: line });
            }
        }
    }

    if (possibleAmounts.length > 0) {
        possibleAmounts.sort((a, b) => {
            if (b.weight !== a.weight) return b.weight - a.weight;
            return b.val - a.val;
        });
        amount = possibleAmounts[0].val;
    }

    // --- 摘要（取引先名）の推測を取引先に変更 ---
    const companyKeywords = ['株式会社', '（株）', '合同会社', '有限会社', '店', 'コーポレーション', '様', '御中', '貴社'];
    const titleKeywords = ['請求書', '領収書', 'レシート', 'INVOICE', 'RECEIPT', '検収書', '納品書'];
    const excludeKeywords = ['〒', '住所', '電話', 'TEL', 'FAX', '銀行', '口座', '振込', '期限', '合計', '単価', '数量', '消費税'];

    let possiblePartners = [];

    for (let line of lines) {
        let trimmedLine = line.trim();
        const normalizedLine = trimmedLine.replace(/\s+/g, '');
        if (normalizedLine.length < 1) continue; // 空行以外は見る

        let score = 0;

        // 加点要素
        if (companyKeywords.some(kw => normalizedLine.includes(kw))) score += 20;
        if (normalizedLine.includes('様') || normalizedLine.includes('御中') || normalizedLine.includes('氏名') || normalizedLine.includes('宛')) score += 15;

        // 減点・除外要素
        if (titleKeywords.some(kw => normalizedLine.includes(kw))) score -= 40;
        if (excludeKeywords.some(kw => normalizedLine.includes(kw))) score -= 20;
        if (/\d{5,}/.test(normalizedLine)) score -= 15; // 郵便番号や電話番号らしきものは大幅減点

        possiblePartners.push({ text: trimmedLine, score: score });
    }

    if (possiblePartners.length > 0) {
        possiblePartners.sort((a, b) => b.score - a.score);

        // 最上位のスコアがマイナスの場合は、よほど何も見つからなかった時のみ採用
        if (possiblePartners[0].score > -10) {
            partner = possiblePartners[0].text;
            // クリーンアップ
            partner = partner.replace(/\s+/g, '') // 全空白除去
                .replace(/^(氏名|宛名|名称)[:：]/, '') // 項目名除去
                .replace(/(様|御中|宛|行)$/, '') // 敬称除去
                .trim();
        } else {
            // フォールバック
            const fallback = lines.find(l => {
                const nl = l.replace(/\s+/g, '');
                return nl.length > 1 && nl.length < 30 &&
                    !titleKeywords.some(kw => nl.includes(kw)) &&
                    !excludeKeywords.some(kw => nl.includes(kw));
            });
            if (fallback) partner = fallback.replace(/\s+/g, '').trim();
        }

        if (partner && partner.length > 25) {
            partner = partner.substring(0, 25) + '...';
        }
    }

    return {
        date,
        amount,
        partner,
        description: '' // 摘要は空にする
    };
}
