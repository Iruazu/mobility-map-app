/**
 * UI制御サービス（全面刷新版）
 * - 検索バー制御
 * - ボトムシート型モーダル
 * - ステータスバー（ステップインジケーター）
 * - Glass-morphism通知
 * - サイドバー制御
 */
export class UIService {
    constructor(robotService, mapService) {
        this.robotService = robotService;
        this.mapService = mapService;
        this.notificationQueue = [];
        this.isProcessingQueue = false;

        // ロボットキャッシュ（検索・モーダル用）
        this.robotCache = {};

        // 現在のライドステータス
        this.currentRideStatus = null;

        this.setupGlobalHandlers();
        this.initializeNotificationSystem();
        this.initializeSidebar();
        this.initializeSearch();
        this.initializeModal();
        this.initializeStatusBar();
    }

    /**
     * RobotServiceの参照を後から設定
     */
    setRobotService(robotService) {
        this.robotService = robotService;
        console.log("✅ UIService: RobotServiceの参照を解決しました");
    }

    // ========================================
    //  Notification System (Glass Morphism)
    // ========================================

    initializeNotificationSystem() {
        if (!document.getElementById('notification-container')) {
            const container = document.createElement('div');
            container.id = 'notification-container';
            container.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2000;display:flex;flex-direction:column;gap:8px;';
            document.body.appendChild(container);
        }
    }

    /**
     * 通知を表示（Glass Morphism版）
     */
    showNotification(message, type = 'info', duration = 3500) {
        const container = document.getElementById('notification-container');
        if (!container) return null;

        const notificationId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const notification = this.createNotificationElement(message, type, notificationId);
        container.appendChild(notification);

        requestAnimationFrame(() => {
            notification.classList.add('show');
        });

        if (type !== 'loading' && duration > 0) {
            setTimeout(() => this.removeNotification(notificationId), duration);
        }

        return notificationId;
    }

    createNotificationElement(message, type, id) {
        const icons = {
            success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️', loading: '⏳'
        };
        const icon = icons[type] || icons.info;

        const notification = document.createElement('div');
        notification.id = id;
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <span class="notification-icon">${icon}</span>
            <span class="notification-message">${message}</span>
            ${type !== 'loading' ? '<button class="notification-close" aria-label="閉じる">×</button>' : ''}
        `;

        const closeBtn = notification.querySelector('.notification-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.removeNotification(id));
        }

        return notification;
    }

    removeNotification(notificationId) {
        const notification = document.getElementById(notificationId);
        if (!notification) return;
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) notification.parentNode.removeChild(notification);
        }, 400);
    }

    clearAllNotifications() {
        const container = document.getElementById('notification-container');
        if (container) container.innerHTML = '';
    }

    // ========================================
    //  Sidebar
    // ========================================

    initializeSidebar() {
        const toggle = document.getElementById('sidebar-toggle');
        const close = document.getElementById('sidebar-close');
        const overlay = document.getElementById('sidebar-overlay');

        if (toggle) toggle.addEventListener('click', () => this.toggleSidebar());
        if (close) close.addEventListener('click', () => this.closeSidebar());
        if (overlay) overlay.addEventListener('click', () => this.closeSidebar());
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        const icon = document.getElementById('hamburger-icon');
        if (!sidebar) return;

        const isOpen = sidebar.classList.toggle('open');
        overlay?.classList.toggle('active', isOpen);
        icon?.classList.toggle('active', isOpen);
    }

    closeSidebar() {
        document.getElementById('sidebar')?.classList.remove('open');
        document.getElementById('sidebar-overlay')?.classList.remove('active');
        document.getElementById('hamburger-icon')?.classList.remove('active');
    }

    /**
     * サイドバーのロボットリストを更新
     */
    updateRobotList(docId, robot) {
        this.robotCache[docId] = robot;
        this.renderRobotList();
    }

    removeRobotFromList(docId) {
        delete this.robotCache[docId];
        this.renderRobotList();
    }

    renderRobotList(filterText = '') {
        const list = document.getElementById('robot-list');
        if (!list) return;

        const filter = filterText.toLowerCase();
        const entries = Object.entries(this.robotCache)
            .filter(([, r]) => {
                if (!filter) return true;
                return (r.id || '').toLowerCase().includes(filter)
                    || (r.status || '').toLowerCase().includes(filter);
            });

        if (entries.length === 0) {
            list.innerHTML = '<p class="no-data">該当するロボットがありません</p>';
            return;
        }

        const statusText = {
            idle: 'アイドリング中',
            in_use: '使用中',
            moving: '走行中',
            dispatching: '配車中'
        };

        list.innerHTML = entries.map(([docId, robot]) => `
            <div class="robot-item status-${(robot.status || '').replace('_', '-')}"
                 data-doc-id="${docId}" 
                 onclick="window.__openRobotModal('${docId}')">
                <div class="robot-name">${robot.id || docId}</div>
                <div class="robot-status">${statusText[robot.status] || robot.status}</div>
                <div class="robot-location">${robot.position ? `${robot.position.latitude?.toFixed(5)}, ${robot.position.longitude?.toFixed(5)}` : '位置不明'}</div>
            </div>
        `).join('');
    }

    // ========================================
    //  Search
    // ========================================

    initializeSearch() {
        const toggleBtn = document.getElementById('search-toggle');
        const closeBtn = document.getElementById('search-close');
        const wrapper = document.getElementById('search-input-wrapper');
        const input = document.getElementById('robot-search-input');

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                wrapper?.classList.add('open');
                toggleBtn.style.display = 'none';
                setTimeout(() => input?.focus(), 300);
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                wrapper?.classList.remove('open');
                if (input) input.value = '';
                if (toggleBtn) toggleBtn.style.display = '';
                this.renderRobotList();
            });
        }

        if (input) {
            input.addEventListener('input', (e) => {
                this.renderRobotList(e.target.value);
            });
        }
    }

    // ========================================
    //  Modal (Bottom Sheet)
    // ========================================

    initializeModal() {
        const overlay = document.getElementById('modal-overlay');
        const modal = document.getElementById('robot-modal');

        if (overlay) overlay.addEventListener('click', () => this.closeModal());

        // グローバル関数を公開
        window.__openRobotModal = (docId) => this.openModal(docId);
    }

    openModal(docId) {
        const robot = this.robotCache[docId];
        if (!robot) return;

        const overlay = document.getElementById('modal-overlay');
        const modal = document.getElementById('robot-modal');
        const nameEl = document.getElementById('modal-robot-name');
        const badgeEl = document.getElementById('modal-status-badge');
        const bodyEl = document.getElementById('modal-body');
        const actionsEl = document.getElementById('modal-actions');

        if (!modal) return;

        // 名前設定
        if (nameEl) nameEl.textContent = robot.id || docId;

        // ステータスバッジ
        const statusColors = {
            idle: '#3b82f6', in_use: '#f59e0b', moving: '#10b981', dispatching: '#8b5cf6'
        };
        const statusLabels = {
            idle: 'アイドリング中', in_use: '使用中', moving: '走行中', dispatching: '配車中'
        };
        if (badgeEl) {
            badgeEl.textContent = statusLabels[robot.status] || robot.status;
            badgeEl.style.backgroundColor = statusColors[robot.status] || '#6b7280';
        }

        // ボディ
        const telemetry = robot.telemetry || {};
        if (bodyEl) {
            bodyEl.innerHTML = `
                <div class="modal-info-grid">
                    <div class="modal-info-item">
                        <div class="modal-info-label">🔋 バッテリー</div>
                        <div class="modal-info-value">${telemetry.battery_percent !== undefined ? telemetry.battery_percent.toFixed(1) + '%' : '--'}</div>
                    </div>
                    <div class="modal-info-item">
                        <div class="modal-info-label">⚡ 速度</div>
                        <div class="modal-info-value">${telemetry.speed !== undefined ? telemetry.speed.toFixed(2) + ' m/s' : '--'}</div>
                    </div>
                    <div class="modal-info-item">
                        <div class="modal-info-label">🎯 目的地まで</div>
                        <div class="modal-info-value">${telemetry.distance_to_goal >= 0 ? telemetry.distance_to_goal.toFixed(1) + ' m' : '未設定'}</div>
                    </div>
                    <div class="modal-info-item">
                        <div class="modal-info-label">📍 位置</div>
                        <div class="modal-info-value" style="font-size:0.75rem">${robot.position ? `${robot.position.latitude?.toFixed(5)}, ${robot.position.longitude?.toFixed(5)}` : '不明'}</div>
                    </div>
                </div>
            `;
        }

        // アクション
        if (actionsEl) {
            let actionsHtml = '';
            if (robot.status === 'idle') {
                actionsHtml = `
                    <button class="modal-btn primary" onclick="handleRideButtonClick('${docId}', 'ride'); window.__closeModal();">🚐 乗車する</button>
                    <button class="modal-btn secondary" onclick="window.__closeModal();">閉じる</button>
                `;
            } else if (robot.status === 'in_use') {
                actionsHtml = `
                    <button class="modal-btn danger" onclick="handleRideButtonClick('${docId}', 'getoff'); window.__closeModal();">🛑 降車する</button>
                    <button class="modal-btn secondary" onclick="window.__closeModal();">閉じる</button>
                `;
            } else {
                actionsHtml = `<button class="modal-btn secondary" onclick="window.__closeModal();">閉じる</button>`;
            }
            actionsEl.innerHTML = actionsHtml;
        }

        // 表示
        overlay?.classList.add('active');
        modal.classList.add('open');

        // マップをロボット位置に移動
        if (robot.position && this.mapService?.map) {
            this.mapService.map.panTo({
                lat: robot.position.latitude,
                lng: robot.position.longitude
            });
        }

        this.closeSidebar();
    }

    closeModal() {
        document.getElementById('modal-overlay')?.classList.remove('active');
        document.getElementById('robot-modal')?.classList.remove('open');
    }

    // ========================================
    //  Status Bar (Step Indicator)
    // ========================================

    initializeStatusBar() {
        const closeBtn = document.getElementById('status-bar-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideStatusBar());
        }

        window.__closeModal = () => this.closeModal();
    }

    /**
     * ステータスバーを指定ステップで表示
     * @param {string} status - dispatching | idle-pickup | in_use | moving | arrived
     */
    showStatusBar(status) {
        const bar = document.getElementById('ride-status-bar');
        if (!bar) return;

        this.currentRideStatus = status;
        bar.classList.add('active');

        const steps = ['dispatching', 'idle-pickup', 'in_use', 'moving', 'arrived'];
        const currentIdx = steps.indexOf(status);

        bar.querySelectorAll('.status-step').forEach((step) => {
            const stepName = step.dataset.step;
            const stepIdx = steps.indexOf(stepName);
            step.classList.remove('active', 'completed');

            if (stepIdx < currentIdx) {
                step.classList.add('completed');
            } else if (stepIdx === currentIdx) {
                step.classList.add('active');
            }
        });
    }

    hideStatusBar() {
        const bar = document.getElementById('ride-status-bar');
        if (bar) bar.classList.remove('active');
        this.currentRideStatus = null;
    }

    /**
     * ロボットのステータス変更に応じてステータスバーを自動更新
     */
    onRobotStatusChange(docId, newStatus, oldStatus) {
        // 配車フロー中のステータス遷移を検知
        const flowStatuses = ['dispatching', 'in_use', 'moving'];

        if (flowStatuses.includes(newStatus)) {
            if (newStatus === 'dispatching') {
                this.showStatusBar('dispatching');
            } else if (newStatus === 'in_use' && oldStatus === 'dispatching') {
                // 配車完了 → 到着
                this.showStatusBar('idle-pickup');
                setTimeout(() => this.showStatusBar('in_use'), 1500);
            } else if (newStatus === 'in_use') {
                this.showStatusBar('in_use');
            } else if (newStatus === 'moving') {
                this.showStatusBar('moving');
            }
        } else if (newStatus === 'idle' && oldStatus === 'moving') {
            // 到着
            this.showStatusBar('arrived');
            setTimeout(() => this.hideStatusBar(), 5000);
        } else if (newStatus === 'idle' && this.currentRideStatus) {
            // フロー終了
            this.hideStatusBar();
        }
    }

    // ========================================
    //  Global Handlers
    // ========================================

    setupGlobalHandlers() {
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
     */
    async handleRideButtonClick(docId, action) {
        try {
            console.log(`🎫 ${action === 'ride' ? '乗車' : '降車'}処理開始: ${docId}`);

            await this.robotService.handleRideAction(docId, action);

            if (action === 'ride') {
                this.showStatusBar('in_use');
                setTimeout(() => {
                    this.showNotification("地図をクリックして目的地を設定してください", "info", 3000);
                }, 1000);
            } else {
                this.hideStatusBar();
            }

        } catch (error) {
            console.error("❌ 乗車/降車処理エラー:", error);
            this.showNotification("操作に失敗しました。再度お試しください。", "error");
        }
    }

    /**
     * ロボット呼び出しボタンクリック処理
     */
    async handleCallRobotClick(lat, lng) {
        try {
            console.log(`📞 ロボット呼び出し: (${lat.toFixed(6)}, ${lng.toFixed(6)})`);

            const loadingId = this.showNotification('ロボットを呼んでいます...', "loading");

            await this.robotService.callRobot(lat, lng);

            this.removeNotification(loadingId);

        } catch (error) {
            console.error("❌ 配車処理エラー:", error);
            this.showNotification("配車リクエストに失敗しました。", "error");
        }
    }

    /**
     * 目的地設定ボタンクリック処理
     */
    async handleSetDestinationClick(robotDocId, lat, lng) {
        try {
            console.log(`🎯 目的地設定: ${robotDocId} → (${lat.toFixed(6)}, ${lng.toFixed(6)})`);

            const loadingId = this.showNotification('経路を計算しています...', "loading");

            await this.robotService.setDestination(robotDocId, lat, lng);

            this.removeNotification(loadingId);

        } catch (error) {
            console.error("❌ 目的地設定エラー:", error);
            this.showNotification("目的地の設定に失敗しました。", "error");
        }
    }

    /**
     * 地図クリック時の処理
     */
    async handleMapClick(location) {
        try {
            if (!this.robotService) {
                this.showNotification("システムが初期化中です。しばらくお待ちください。", "warning");
                return;
            }

            const inUseRobot = await this.robotService.getInUseRobot();

            if (inUseRobot) {
                console.log("📍 目的地設定モード");
                this.mapService.placeDestinationMarker(location, inUseRobot.id);
            } else {
                console.log("📍 配車リクエストモード");
                this.mapService.placePickupMarker(location);
            }

        } catch (error) {
            console.error("❌ 地図クリック処理エラー:", error);
            this.showNotification("操作に失敗しました。", "error");
        }
    }

    // ========================================
    //  Debug
    // ========================================

    showDebugInfo() {
        console.log('=== UIService Debug Info ===');
        console.log('RobotService:', this.robotService ? '✅ Connected' : '❌ Not Connected');
        console.log('MapService:', this.mapService ? '✅ Connected' : '❌ Not Connected');
        console.log('Active Markers:', this.mapService ? Object.keys(this.mapService.activeMarkers).length : 0);
        console.log('User Marker:', this.mapService?.userMarker ? '✅ Present' : '❌ None');
        console.log('Map Initialized:', this.mapService?.map ? '✅ Yes' : '❌ No');
        console.log('Robot Cache:', Object.keys(this.robotCache).length);
        console.log('=== End Debug Info ===');
    }

    // ========================================
    //  Cleanup
    // ========================================

    cleanup() {
        console.log("🧹 UIService クリーンアップ中...");

        this.clearAllNotifications();

        const container = document.getElementById('notification-container');
        if (container) container.remove();

        delete window.handleRideButtonClick;
        delete window.handleCallRobotClick;
        delete window.handleSetDestinationClick;
        delete window.__openRobotModal;
        delete window.__closeModal;

        console.log("✅ UIService クリーンアップ完了");
    }
}