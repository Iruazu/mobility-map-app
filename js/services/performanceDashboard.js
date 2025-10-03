/**
 * パフォーマンス監視ダッシュボード
 */
export class PerformanceDashboard {
    constructor(robotService) {
        this.robotService = robotService;
        this.isVisible = false;
        this.dashboardElement = null;
        this.updateInterval = null;
    }

    /**
     * ダッシュボードを表示/非表示切り替え
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * ダッシュボードを表示
     */
    show() {
        if (this.isVisible) return;

        this.createDashboardElement();
        document.body.appendChild(this.dashboardElement);
        this.startAutoUpdate();
        this.isVisible = true;
        
        console.log('パフォーマンスダッシュボードを表示しました');
    }

    /**
     * ダッシュボードを非表示
     */
    hide() {
        if (!this.isVisible || !this.dashboardElement) return;

        this.stopAutoUpdate();
        this.dashboardElement.remove();
        this.dashboardElement = null;
        this.isVisible = false;
        
        console.log('パフォーマンスダッシュボードを非表示にしました');
    }

    /**
     * ダッシュボード要素を作成
     */
    createDashboardElement() {
        this.dashboardElement = document.createElement('div');
        this.dashboardElement.id = 'performance-dashboard';
        this.dashboardElement.className = 'fixed top-16 right-4 w-80 bg-white border border-gray-300 rounded-lg shadow-lg z-40 p-4';
        
        // ダッシュボードのHTML構造を設定
        this.dashboardElement.innerHTML = `
            <div class="flex justify-between items-center mb-3 border-b pb-2">
                <h3 class="font-bold text-lg text-gray-800">パフォーマンス監視</h3>
                <button onclick="hidePerfDashboard()" class="text-gray-500 hover:text-gray-700 text-xl leading-none">×</button>
            </div>
            <div id="perf-content" class="space-y-2">
                <div class="text-sm text-gray-600">読み込み中...</div>
            </div>
        `;

        // グローバル関数を設定
        window.hidePerfDashboard = () => this.hide();
        
        this.updateContent();
    }

    /**
     * ダッシュボードの内容を更新
     */
    updateContent() {
        if (!this.dashboardElement) return;

        const contentElement = this.dashboardElement.querySelector('#perf-content');
        if (!contentElement) return;

        try {
            let metrics;
            if (this.robotService && typeof this.robotService.getPerformanceMetrics === 'function') {
                metrics = this.robotService.getPerformanceMetrics();
            } else {
                contentElement.innerHTML = '<div class="text-red-500 text-sm">パフォーマンスメトリクスが利用できません</div>';
                return;
            }

            const html = this.generateMetricsHTML(metrics);
            contentElement.innerHTML = html;
            
        } catch (error) {
            console.error('ダッシュボード更新エラー:', error);
            contentElement.innerHTML = '<div class="text-red-500 text-sm">データ取得エラー</div>';
        }
    }

    /**
     * メトリクスのHTMLを生成
     * @param {Object} metrics - パフォーマンスメトリクス
     * @returns {string} HTML文字列
     */
    generateMetricsHTML(metrics) {
        return `
            <div class="grid grid-cols-1 gap-2 text-xs">
                <!-- 更新統計 -->
                <div class="bg-blue-50 p-2 rounded">
                    <div class="font-semibold text-blue-800 mb-1">更新統計</div>
                    <div class="flex justify-between">
                        <span>総更新数:</span>
                        <span class="font-mono">${metrics.updates?.total || 0}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>スキップ数:</span>
                        <span class="font-mono text-orange-600">${metrics.updates?.skipped || 0}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>バッチ処理:</span>
                        <span class="font-mono text-green-600">${metrics.updates?.batched || 0}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>効率:</span>
                        <span class="font-mono font-bold ${this.getEfficiencyColor(metrics.performance?.updateEfficiency)}">${metrics.performance?.updateEfficiency || '0%'}</span>
                    </div>
                </div>

                <!-- タイミング情報 -->
                <div class="bg-green-50 p-2 rounded">
                    <div class="font-semibold text-green-800 mb-1">応答時間</div>
                    <div class="flex justify-between">
                        <span>平均:</span>
                        <span class="font-mono">${metrics.performance?.avgResponseTime || '0ms'}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>最大:</span>
                        <span class="font-mono">${metrics.timing?.maxUpdateTime?.toFixed(2) || 0}ms</span>
                    </div>
                    <div class="flex justify-between">
                        <span>最新:</span>
                        <span class="font-mono">${metrics.timing?.lastUpdateTime?.toFixed(2) || 0}ms</span>
                    </div>
                </div>

                <!-- システム状態 -->
                <div class="bg-purple-50 p-2 rounded">
                    <div class="font-semibold text-purple-800 mb-1">システム状態</div>
                    <div class="flex justify-between">
                        <span>位置履歴:</span>
                        <span class="font-mono">${metrics.system?.lastPositions || 0}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>速度データ:</span>
                        <span class="font-mono">${metrics.system?.robotSpeeds || 0}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>更新キュー:</span>
                        <span class="font-mono ${metrics.system?.queuedUpdates > 10 ? 'text-red-600' : 'text-green-600'}">${metrics.system?.queuedUpdates || 0}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>実行中:</span>
                        <span class="font-mono">${metrics.system?.activeSimulations || 0}</span>
                    </div>
                </div>

                <!-- メモリ情報 -->
                <div class="bg-gray-50 p-2 rounded">
                    <div class="font-semibold text-gray-800 mb-1">メモリ使用</div>
                    <div class="flex justify-between">
                        <span>アクティブマーカー:</span>
                        <span class="font-mono">${metrics.memory?.activeMarkers || 0}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>実行中シミュレーション:</span>
                        <span class="font-mono">${metrics.memory?.activeSimulations || 0}</span>
                    </div>
                </div>

                <!-- 操作ボタン -->
                <div class="flex gap-1 mt-3 pt-2 border-t">
                    <button onclick="resetPerformanceMetrics()" 
                            class="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white text-xs py-1 px-2 rounded">
                        リセット
                    </button>
                    <button onclick="console.log(getPerformanceMetrics())" 
                            class="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs py-1 px-2 rounded">
                        ログ出力
                    </button>
                </div>
                
                <!-- 最終更新時刻 -->
                <div class="text-center text-gray-500 text-xs mt-2">
                    最終更新: ${new Date().toLocaleTimeString()}
                </div>
            </div>
        `;
    }

    /**
     * 効率値に応じた色を取得
     * @param {string} efficiency - 効率値（例: "85.2%"）
     * @returns {string} CSS class
     */
    getEfficiencyColor(efficiency) {
        if (!efficiency) return 'text-gray-500';
        
        const value = parseFloat(efficiency);
        if (value >= 90) return 'text-green-600';
        if (value >= 75) return 'text-yellow-600';
        return 'text-red-600';
    }

    /**
     * 自動更新を開始
     */
    startAutoUpdate() {
        this.updateInterval = setInterval(() => {
            this.updateContent();
        }, 2000); // 2秒ごとに更新
    }

    /**
     * 自動更新を停止
     */
    stopAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * クリーンアップ
     */
    cleanup() {
        this.hide();
        delete window.hidePerfDashboard;
    }
}