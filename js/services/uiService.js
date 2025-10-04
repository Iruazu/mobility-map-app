/**
 * UI制御サービス（改善版）
 * ROS2統合対応、通知システム強化
 */
export class UIService {
    constructor(robotService, mapService) {
        this.robotService = robotService; // 初期化時はnullの可能性あり
        this.mapService = mapService;
        this.notificationQueue = [];
        this.isProcessingQueue = false;
        
        this.setupGlobalHandlers();
        this.initializeNotificationSystem();
    }

    /**
     * RobotServiceの参照を後から設定（main.jsの初期化順序問題を解決）
     * @param {RobotService} robotService
     */
    setRobotService(robotService) {
        this.robotService = robotService;
        console.log("✅ UIService: RobotServiceの参照を解決しました");
    }

    /**
     * 通知システムを初期化
     */
    initializeNotificationSystem() {
        // 通知コンテナを作成
        if (!document.getElementById('notification-container')) {
            const container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'fixed top-4 right-4 z-50 space-y-2';
            document.body.appendChild(container);
        }
    }

    /**
     * グローバル関数ハンドラーを設定
     */
    setupGlobalHandlers() {
        // HTMLのonclickから呼び出されるグローバル関数
        window.handleRideButtonClick = (docId, action) => {
            if (this.robotService) {
                this.handleRideButtonClick(docId, action);
            } else {
                console.error("❌ RobotServiceが初期化されていません");
                this.showNotification("システムが初期化中です。しばらくお待ちください。", "warning");
            }
        };

        window.handleCallRobotClick = (lat, lng) => {
            if (this.robotService) {
                this.handleCallRobotClick(lat, lng);
            } else {
                console.error("❌ RobotServiceが初期化されていません");
                this.showNotification("システムが初期化中です。しばらくお待ちください。", "warning");
            }
        };

        window.handleSetDestinationClick = (robotDocId, lat, lng) => {
            if (this.robotService) {
                this.handleSetDestinationClick(robotDocId, lat, lng);
            } else {
                console.error("❌ RobotServiceが初期化されていません");
                this.showNotification("システムが初期化中です。しばらくお待ちください。", "warning");
            }
        };

        console.log("✅ グローバルハンドラーを設定しました");
    }

    /**
     * 乗車/降車ボタンクリック処理
     * @param {string} docId - ドキュメントID
     * @param {string} action - 'ride' または 'getoff'
     */
    async handleRideButtonClick(docId, action) {
        try {
            console.log(`🎫 ${action === 'ride' ? '乗車' : '降車'}処理開始: ${docId}`);
            
            await this.robotService.handleRideAction(docId, action);
            
            // 処理成功後の追加メッセージ
            if (action === 'ride') {
                // 乗車時のガイダンス
                setTimeout(() => {
                    this.showNotification(
                        "地図をクリックして目的地を設定してください", 
                        "info", 
                        3000
                    );
                }, 1000);
            }
            
        } catch (error) {
            console.error("❌ 乗車/降車処理エラー:", error);
            this.showNotification("操作に失敗しました。再度お試しください。", "error");
        }
    }

    /**
     * ロボット呼び出しボタンクリック処理
     * @param {number} lat - 緯度
     * @param {number} lng - 経度
     */
    async handleCallRobotClick(lat, lng) {
        try {
            console.log(`📞 ロボット呼び出し: (${lat.toFixed(6)}, ${lng.toFixed(6)})`);
            
            // ローディング表示
            const loadingId = this.showNotification('ロボットを呼んでいます...', "loading");
            
            await this.robotService.callRobot(lat, lng);
            
            // ローディング削除
            this.removeNotification(loadingId);
            
        } catch (error) {
            console.error("❌ 配車処理エラー:", error);
            this.showNotification("配車リクエストに失敗しました。", "error");
        }
    }

    /**
     * 目的地設定ボタンクリック処理
     * @param {string} robotDocId - ロボットのドキュメントID
     * @param {number} lat - 緯度
     * @param {number} lng - 経度
     */
    async handleSetDestinationClick(robotDocId, lat, lng) {
        try {
            console.log(`🎯 目的地設定: ${robotDocId} → (${lat.toFixed(6)}, ${lng.toFixed(6)})`);
            
            // ローディング表示
            const loadingId = this.showNotification('経路を計算しています...', "loading");
            
            await this.robotService.setDestination(robotDocId, lat, lng);
            
            // ローディング削除
            this.removeNotification(loadingId);
            
        } catch (error) {
            console.error("❌ 目的地設定エラー:", error);
            this.showNotification("目的地の設定に失敗しました。", "error");
        }
    }

    /**
     * 地図クリック時の処理
     * @param {google.maps.LatLng} location - クリック位置
     */
    async handleMapClick(location) {
        try {
            if (!this.robotService) {
                this.showNotification("システムが初期化中です。しばらくお待ちください。", "warning");
                return;
            }

            // 使用中のロボットを確認
            const inUseRobot = await this.robotService.getInUseRobot();

            if (inUseRobot) {
                // 使用中のロボットがいる場合 → 目的地設定モード
                console.log("📍 目的地設定モード");
                this.mapService.placeDestinationMarker(location, inUseRobot.id);
            } else {
                // 使用中のロボットがいない場合 → 配車リクエストモード
                console.log("📍 配車リクエストモード");
                this.mapService.placePickupMarker(location);
            }
            
        } catch (error) {
            console.error("❌ 地図クリック処理エラー:", error);
            this.showNotification("操作に失敗しました。", "error");
        }
    }

    /**
     * 通知を表示（改善版）
     * @param {string} message - メッセージ
     * @param {string} type - タイプ ('success', 'error', 'warning', 'info', 'loading')
     * @param {number} duration - 表示時間（ミリ秒、0で自動削除なし）
     * @returns {string} 通知ID
     */
    showNotification(message, type = 'info', duration = 3000) {
        const container = document.getElementById('notification-container');
        if (!container) {
            console.error("❌ 通知コンテナが見つかりません");
            return null;
        }

        // 通知要素を作成
        const notificationId = `notification-${Date.now()}-${Math.random()}`;
        const notification = this.createNotificationElement(message, type, notificationId);
        
        container.appendChild(notification);

        // フェードイン効果
        setTimeout(() => {
            notification.classList.add('notification-show');
        }, 10);

        // 自動削除（loadingタイプとduration=0は除く）
        if (type !== 'loading' && duration > 0) {
            setTimeout(() => {
                this.removeNotification(notificationId);
            }, duration);
        }

        return notificationId;
    }

    /**
     * 通知要素を作成
     * @param {string} message - メッセージ
     * @param {string} type - タイプ
     * @param {string} id - 通知ID
     * @returns {HTMLElement} 通知要素
     */
    createNotificationElement(message, type, id) {
        const notification = document.createElement('div');
        notification.id = id;
        notification.className = 'notification';
        
        // タイプに応じたスタイル
        const styles = {
            success: 'bg-green-500 text-white',
            error: 'bg-red-500 text-white',
            warning: 'bg-yellow-500 text-white',
            info: 'bg-blue-500 text-white',
            loading: 'bg-gray-700 text-white'
        };
        
        // アイコン
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
            loading: '⏳'
        };
        
        const styleClass = styles[type] || styles.info;
        const icon = icons[type] || icons.info;
        
        notification.className = `notification px-4 py-3 rounded-lg shadow-lg ${styleClass} flex items-center gap-2 min-w-[250px] max-w-[400px] transform transition-all duration-300 opacity-0 translate-x-full`;
        
        notification.innerHTML = `
            <span class="text-lg">${icon}</span>
            <span class="flex-1">${message}</span>
            ${type !== 'loading' ? '<button class="notification-close ml-2 text-white hover:text-gray-200">×</button>' : ''}
        `;
        
        // 閉じるボタンのイベント
        const closeBtn = notification.querySelector('.notification-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.removeNotification(id);
            });
        }
        
        return notification;
    }

    /**
     * 通知を削除
     * @param {string} notificationId - 通知ID
     */
    removeNotification(notificationId) {
        const notification = document.getElementById(notificationId);
        if (!notification) return;
        
        // フェードアウト効果
        notification.classList.remove('notification-show');
        notification.classList.add('opacity-0', 'translate-x-full');
        
        // DOM から削除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }

    /**
     * すべての通知を削除
     */
    clearAllNotifications() {
        const container = document.getElementById('notification-container');
        if (container) {
            container.innerHTML = '';
        }
    }

    /**
     * デバッグ情報を表示
     */
    showDebugInfo() {
        console.log('=== UIService Debug Info ===');
        console.log('RobotService:', this.robotService ? '✅ Connected' : '❌ Not Connected');
        console.log('MapService:', this.mapService ? '✅ Connected' : '❌ Not Connected');
        console.log('Active Markers:', this.mapService ? Object.keys(this.mapService.activeMarkers).length : 0);
        console.log('User Marker:', this.mapService?.userMarker ? '✅ Present' : '❌ None');
        console.log('Map Initialized:', this.mapService?.map ? '✅ Yes' : '❌ No');
        console.log('=== End Debug Info ===');
    }

    /**
     * システムステータスを画面に表示（デバッグ用）
     */
    showSystemStatus() {
        const status = {
            robotService: !!this.robotService,
            mapService: !!this.mapService,
            activeMarkers: this.mapService ? Object.keys(this.mapService.activeMarkers).length : 0,
            userMarker: this.mapService?.userMarker ? 'Present' : 'None',
            mapInitialized: this.mapService?.map ? 'Yes' : 'No'
        };
        
        const statusHtml = `
            <div style="position: fixed; bottom: 10px; left: 10px; background: rgba(0,0,0,0.8); color: white; padding: 10px; border-radius: 5px; font-family: monospace; font-size: 12px; z-index: 9999;">
                <strong>System Status</strong><br>
                RobotService: ${status.robotService ? '✅' : '❌'}<br>
                MapService: ${status.mapService ? '✅' : '❌'}<br>
                Active Markers: ${status.activeMarkers}<br>
                User Marker: ${status.userMarker}<br>
                Map: ${status.mapInitialized}
            </div>
        `;
        
        let statusDiv = document.getElementById('system-status-display');
        if (!statusDiv) {
            statusDiv = document.createElement('div');
            statusDiv.id = 'system-status-display';
            document.body.appendChild(statusDiv);
        }
        statusDiv.innerHTML = statusHtml;
        
        // 5秒後に自動削除
        setTimeout(() => {
            const div = document.getElementById('system-status-display');
            if (div) div.remove();
        }, 5000);
    }

    /**
     * クリーンアップ処理
     */
    cleanup() {
        console.log("🧹 UIService クリーンアップ中...");
        
        // 通知をクリア
        this.clearAllNotifications();
        
        // 通知コンテナを削除
        const container = document.getElementById('notification-container');
        if (container) {
            container.remove();
        }
        
        // グローバル関数を削除
        delete window.handleRideButtonClick;
        delete window.handleCallRobotClick;
        delete window.handleSetDestinationClick;
        
        console.log("✅ UIService クリーンアップ完了");
    }
}