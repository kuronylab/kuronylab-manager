import Chart from 'chart.js/auto';

let currentChart = null;

export function renderIncomeExpenseChart(canvasElement, monthlyData) {
    if (currentChart) {
        currentChart.destroy();
    }

    const labels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

    // データの色定義（CSS変数と合わせる）
    const incomeColor = '#10b981'; // emerald
    const expenseColor = '#f43f5e'; // rose

    const data = {
        labels: labels,
        datasets: [
            {
                label: '収入',
                data: monthlyData.incomes,
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                borderColor: incomeColor,
                borderWidth: 2,
                tension: 0.3,
                fill: true
            },
            {
                label: '支出',
                data: monthlyData.expenses,
                backgroundColor: 'rgba(244, 63, 94, 0.2)',
                borderColor: expenseColor,
                borderWidth: 2,
                tension: 0.3,
                fill: true
            }
        ]
    };

    const config = {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#94a3b8', // text-muted
                        usePointStyle: true,
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#e2e8f0',
                    bodyColor: '#e2e8f0',
                    borderColor: 'rgba(51, 65, 85, 0.5)',
                    borderWidth: 1,
                    padding: 10,
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(51, 65, 85, 0.2)',
                    },
                    ticks: {
                        color: '#94a3b8'
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(51, 65, 85, 0.2)',
                    },
                    ticks: {
                        color: '#94a3b8',
                        callback: function (value) {
                            return '¥' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    };

    currentChart = new Chart(canvasElement, config);
    return currentChart;
}
