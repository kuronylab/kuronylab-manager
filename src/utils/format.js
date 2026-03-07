// 金額フォーマット（¥1,234,567）
export function formatCurrency(amount) {
    if (amount == null || isNaN(amount)) return '¥0';
    const abs = Math.abs(Math.round(amount));
    const formatted = abs.toLocaleString('ja-JP');
    return amount < 0 ? `-¥${formatted}` : `¥${formatted}`;
}

// 金額フォーマット（符号なし、カンマ区切りのみ）
export function formatNumber(num) {
    if (num == null || isNaN(num)) return '0';
    return Math.round(num).toLocaleString('ja-JP');
}

// 日付フォーマット（YYYY-MM-DD → YYYY/MM/DD）
export function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}/${m}/${day}`;
}

// 月名（1月〜12月）
export function getMonthName(month) {
    return `${month}月`;
}

// 年月文字列（2025年3月）
export function formatYearMonth(year, month) {
    return `${year}年${month}月`;
}

// 今日の日付（YYYY-MM-DD）
export function today() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// 日付からYYYY-MM-DD文字列を生成
export function toDateString(date) {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// UUID生成
export function generateId() {
    return crypto.randomUUID ? crypto.randomUUID() :
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
}

// 数値のカウントアップアニメーション
export function animateNumber(element, target, duration = 800) {
    const start = 0;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(start + (target - start) * eased);
        element.textContent = formatCurrency(current);
        if (progress < 1) requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
}
