// 勘定科目マスタデータ（EC販売業向け）
export const DEFAULT_ACCOUNTS = [
  // 資産（1xxx）
  { code: '1001', name: '現金', category: 'asset', type: '資産' },
  { code: '1002', name: '普通預金', category: 'asset', type: '資産' },
  { code: '1003', name: '売掛金', category: 'asset', type: '資産' },
  { code: '1004', name: '棚卸資産', category: 'asset', type: '資産' },
  { code: '1005', name: '事業主貸', category: 'asset', type: '資産' },
  { code: '1006', name: '前払費用', category: 'asset', type: '資産' },
  { code: '1007', name: '工具器具備品', category: 'asset', type: '資産' },

  // 負債（2xxx）
  { code: '2001', name: '買掛金', category: 'liability', type: '負債' },
  { code: '2002', name: '未払金', category: 'liability', type: '負債' },
  { code: '2003', name: '事業主借', category: 'liability', type: '負債' },
  { code: '2004', name: '預り金', category: 'liability', type: '負債' },

  // 純資産（3xxx）
  { code: '3001', name: '元入金', category: 'equity', type: '純資産' },

  // 収益（4xxx）
  { code: '4001', name: '売上高', category: 'revenue', type: '収益' },
  { code: '4002', name: '雑収入', category: 'revenue', type: '収益' },

  // 費用（5xxx）
  { code: '5001', name: '仕入高', category: 'expense', type: '費用' },
  { code: '5002', name: '荷造運賃', category: 'expense', type: '費用' },
  { code: '5003', name: '通信費', category: 'expense', type: '費用' },
  { code: '5004', name: '広告宣伝費', category: 'expense', type: '費用' },
  { code: '5005', name: '接待交際費', category: 'expense', type: '費用' },
  { code: '5006', name: '消耗品費', category: 'expense', type: '費用' },
  { code: '5007', name: '支払手数料', category: 'expense', type: '費用' },
  { code: '5008', name: '旅費交通費', category: 'expense', type: '費用' },
  { code: '5009', name: '水道光熱費', category: 'expense', type: '費用' },
  { code: '5010', name: '地代家賃', category: 'expense', type: '費用' },
  { code: '5011', name: '減価償却費', category: 'expense', type: '費用' },
  { code: '5012', name: '雑費', category: 'expense', type: '費用' },
  { code: '5013', name: '外注工賃', category: 'expense', type: '費用' },
  { code: '5014', name: '新聞図書費', category: 'expense', type: '費用' },
  { code: '5015', name: '租税公課', category: 'expense', type: '費用' },
  { code: '5016', name: '保険料', category: 'expense', type: '費用' },
];

// カテゴリ名からバッジクラスを取得
export function getCategoryBadgeClass(category) {
  const map = {
    asset: 'badge-asset',
    liability: 'badge-liability',
    equity: 'badge-equity',
    revenue: 'badge-income',
    expense: 'badge-expense',
  };
  return map[category] || '';
}

// カテゴリ名の日本語表記
export function getCategoryLabel(category) {
  const map = {
    asset: '資産',
    liability: '負債',
    equity: '純資産',
    revenue: '収益',
    expense: '費用',
  };
  return map[category] || category;
}
