export const STRINGS = {
    'app.title': 'FIRE モンテカルロ・シミュレータ',
    'button.run': 'シミュレーション実行',
    'summary.successRate': 'FIRE 成功率',
    'summary.finalMedian': '最終総資産 中央値',
    'section.assetSettings': '資産設定',
    'section.marketSettings': 'マーケット設定',
    'section.simSettings': 'シミュレーション設定',
    'section.cashBuffer': '現金バッファ設定',
    'section.guardrail': '支出ガードレール設定',
};
export function t(key) { return STRINGS[key] || key; }
