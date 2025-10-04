/**
 * sensorDashboard.js - Improved Real-time Sensor Dashboard
 * ROS2統合対応版
 */

export class SensorDashboard {
    constructor(mapService) {
        this.mapService = mapService;
        this.sensorPanels = {};
        this.isCollapsed = false;
        
        // ステータス定義（ROS2と一致）
        this.STATUS = {
            IDLE: 'idle',
            IN_USE: 'in_use',
            MOVING: 'moving',
            DISPATCHING: 'dispatching'
        };
        
        // ステータス表示名（日本語）
        this.STATUS_DISPLAY = {
            'idle': { text: 'アイドリング中', class: 'idle', color: '#3b82f6' },
            'in_use': { text: '使用中', class: 'in-use', color: '#f59e0b' },
            'moving': { text: '走行中', class: 'moving', color: '#10b981' },
            'dispatching': { text: '配車中', class: 'dispatching', color: '#8b5cf6' }
        };
        
        this.createDashboardUI();
    }

    /**
     * ダッシュボードUI要素を作成
     */
    createDashboardUI() {
        if (document.getElementById('sensor-dashboard')) {
            console.warn('⚠️ センサーダッシュボードは既に存在します');
            return;
        }

        const dashboard = document.createElement('div');
        dashboard.id = 'sensor-dashboard';
        dashboard.className = 'sensor-dashboard';
        dashboard.innerHTML = `
            <div class="dashboard-header">
                <h3>🤖 ロボットテレメトリ</h3>
                <button id="toggle-dashboard" class="toggle-btn" title="最小化/展開">▼</button>
            </div>
            <div id="sensor-panels" class="sensor-panels">
                <p class="no-data">ロボットが選択されていません</p>
            </div>
        `;

        document.body.appendChild(dashboard);

        // トグルボタンのイベントリスナー
        const toggleBtn = document.getElementById('toggle-dashboard');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleDashboard());
        }
        
        console.log('✅ センサーダッシュボードを初期化しました');
    }

    /**
     * ロボットセンサーデータを更新
     * @param {string} robotId - ロボットのドキュメントID
     * @param {Object} robotData - Firestoreから取得したロボットデータ
     */
    updateRobotSensors(robotId, robotData) {
        const telemetry = robotData.telemetry || {};
        const panelsContainer = document.getElementById('sensor-panels');

        if (!panelsContainer) {
            console.error('❌ センサーパネルコンテナが見つかりません');
            return;
        }

        // パネルが存在しない場合は新規作成
        if (!this.sensorPanels[robotId]) {
            this.sensorPanels[robotId] = this.createSensorPanel(robotId, robotData);
            
            // 「データなし」メッセージをクリア
            if (panelsContainer.querySelector('.no-data')) {
                panelsContainer.innerHTML = '';
            }
            
            panelsContainer.appendChild(this.sensorPanels[robotId]);
            console.log(`📊 ${robotId} のパネルを作成しました`);
        }

        // パネル内容を更新
        this.updatePanelContent(robotId, robotData, telemetry);
    }

    /**
     * センサーパネル要素を作成
     * @param {string} robotId - ロボットID
     * @param {Object} robotData - ロボットデータ
     * @returns {HTMLElement} パネル要素
     */
    createSensorPanel(robotId, robotData) {
        const panel = document.createElement('div');
        panel.id = `sensor-panel-${robotId}`;
        panel.className = 'sensor-panel';
        panel.innerHTML = `
            <div class="panel-title">
                <span class="robot-name">${robotData.name || robotData.id || robotId}</span>
                <span class="status-indicator" id="status-${robotId}"></span>
            </div>
            
            <div class="sensor-grid">
                <!-- バッテリー -->
                <div class="sensor-item">
                    <div class="sensor-icon">🔋</div>
                    <div class="sensor-data">
                        <div class="sensor-label">バッテリー</div>
                        <div class="sensor-value" id="battery-${robotId}">--</div>
                        <div class="sensor-bar">
                            <div class="sensor-bar-fill" id="battery-bar-${robotId}" style="width: 0%"></div>
                        </div>
                        <div class="sensor-meta" id="battery-voltage-${robotId}"></div>
                    </div>
                </div>
                
                <!-- 速度 -->
                <div class="sensor-item">
                    <div class="sensor-icon">⚡</div>
                    <div class="sensor-data">
                        <div class="sensor-label">速度</div>
                        <div class="sensor-value" id="speed-${robotId}">--</div>
                    </div>
                </div>
                
                <!-- 目的地までの距離 -->
                <div class="sensor-item">
                    <div class="sensor-icon">🎯</div>
                    <div class="sensor-data">
                        <div class="sensor-label">目的地まで</div>
                        <div class="sensor-value" id="distance-${robotId}">--</div>
                    </div>
                </div>
                
                <!-- 障害物検知 -->
                <div class="sensor-item">
                    <div class="sensor-icon">🚧</div>
                    <div class="sensor-data">
                        <div class="sensor-label">障害物</div>
                        <div class="sensor-value" id="obstacle-${robotId}">--</div>
                    </div>
                </div>
            </div>
            
            <!-- 最終更新時刻 -->
            <div class="panel-footer">
                <span class="last-update" id="last-update-${robotId}">更新待ち...</span>
            </div>
        `;
        
        return panel;
    }

    /**
     * パネル内容を最新データで更新
     * @param {string} robotId - ロボットID
     * @param {Object} robotData - ロボットデータ
     * @param {Object} telemetry - テレメトリデータ
     */
    updatePanelContent(robotId, robotData, telemetry) {
        // ステータスインジケーター更新
        this.updateStatusIndicator(robotId, robotData.status);
        
        // バッテリー情報更新
        this.updateBatteryDisplay(robotId, telemetry);
        
        // 速度情報更新
        this.updateSpeedDisplay(robotId, telemetry);
        
        // 目的地までの距離更新
        this.updateDistanceDisplay(robotId, telemetry);
        
        // 障害物情報更新
        this.updateObstacleDisplay(robotId, telemetry);
        
        // 最終更新時刻
        this.updateTimestamp(robotId);
    }

    /**
     * ステータスインジケーターを更新
     */
    updateStatusIndicator(robotId, status) {
        const statusEl = document.getElementById(`status-${robotId}`);
        if (!statusEl) return;
        
        const statusInfo = this.STATUS_DISPLAY[status] || { 
            text: status, 
            class: 'unknown', 
            color: '#6b7280' 
        };
        
        statusEl.textContent = statusInfo.text;
        statusEl.className = `status-indicator status-${statusInfo.class}`;
        statusEl.style.backgroundColor = statusInfo.color;
    }

    /**
     * バッテリー表示を更新
     */
    updateBatteryDisplay(robotId, telemetry) {
        const batteryPercent = telemetry.battery_percent ?? 0;
        const batteryVoltage = telemetry.battery_voltage ?? 0;
        const isCharging = telemetry.battery_charging ?? false;
        
        // バッテリー残量
        const batteryEl = document.getElementById(`battery-${robotId}`);
        if (batteryEl) {
            const chargingIcon = isCharging ? '⚡' : '';
            batteryEl.textContent = `${batteryPercent.toFixed(1)}% ${chargingIcon}`;
            
            // 色分け
            if (batteryPercent > 50) {
                batteryEl.style.color = '#10b981'; // 緑
            } else if (batteryPercent > 20) {
                batteryEl.style.color = '#f59e0b'; // 黄
            } else {
                batteryEl.style.color = '#ef4444'; // 赤
            }
        }
        
        // バッテリーバー
        const batteryBarEl = document.getElementById(`battery-bar-${robotId}`);
        if (batteryBarEl) {
            batteryBarEl.style.width = `${Math.min(batteryPercent, 100)}%`;
            batteryBarEl.style.backgroundColor = batteryPercent > 20 ? '#10b981' : '#ef4444';
        }
        
        // 電圧表示
        const voltageEl = document.getElementById(`battery-voltage-${robotId}`);
        if (voltageEl && batteryVoltage > 0) {
            voltageEl.textContent = `${batteryVoltage.toFixed(1)}V`;
            voltageEl.style.fontSize = '0.7em';
            voltageEl.style.color = '#9ca3af';
        }
    }

    /**
     * 速度表示を更新
     */
    updateSpeedDisplay(robotId, telemetry) {
        const speed = telemetry.speed ?? 0;
        const speedEl = document.getElementById(`speed-${robotId}`);
        
        if (speedEl) {
            speedEl.textContent = `${speed.toFixed(2)} m/s`;
            
            // 速度に応じた色分け
            if (speed > 0.1) {
                speedEl.style.color = '#10b981'; // 移動中は緑
            } else {
                speedEl.style.color = '#6b7280'; // 停止中はグレー
            }
        }
    }

    /**
     * 目的地までの距離表示を更新
     */
    updateDistanceDisplay(robotId, telemetry) {
        const distance = telemetry.distance_to_goal;
        const distanceEl = document.getElementById(`distance-${robotId}`);
        
        if (!distanceEl) return;
        
        if (distance !== null && distance !== undefined && distance >= 0) {
            distanceEl.textContent = `${distance.toFixed(1)} m`;
            
            // 距離に応じた色分け
            if (distance < 1) {
                distanceEl.style.color = '#10b981'; // 到着間近は緑
            } else if (distance < 10) {
                distanceEl.style.color = '#f59e0b'; // 近いは黄
            } else {
                distanceEl.style.color = '#6b7280'; // 遠いはグレー
            }
        } else {
            distanceEl.textContent = '目的地なし';
            distanceEl.style.color = '#9ca3af';
        }
    }

    /**
     * 障害物情報表示を更新
     */
    updateObstacleDisplay(robotId, telemetry) {
        const obstacleDetected = telemetry.obstacle_detected ?? false;
        const minDistance = telemetry.min_obstacle_distance;
        const obstacleEl = document.getElementById(`obstacle-${robotId}`);
        
        if (!obstacleEl) return;
        
        if (obstacleDetected && minDistance !== undefined) {
            obstacleEl.textContent = `⚠️ ${minDistance.toFixed(2)} m`;
            obstacleEl.style.color = '#ef4444'; // 赤
            obstacleEl.style.fontWeight = 'bold';
        } else {
            obstacleEl.textContent = 'クリア';
            obstacleEl.style.color = '#10b981'; // 緑
            obstacleEl.style.fontWeight = 'normal';
        }
    }

    /**
     * タイムスタンプを更新
     */
    updateTimestamp(robotId) {
        const timestampEl = document.getElementById(`last-update-${robotId}`);
        if (timestampEl) {
            const now = new Date();
            timestampEl.textContent = `最終更新: ${now.toLocaleTimeString('ja-JP')}`;
        }
    }

    /**
     * ロボットパネルを削除
     * @param {string} robotId - ロボットID
     */
    removeRobotPanel(robotId) {
        const panel = this.sensorPanels[robotId];
        
        if (panel && panel.parentNode) {
            panel.parentNode.removeChild(panel);
            delete this.sensorPanels[robotId];
            console.log(`🗑️ ${robotId} のパネルを削除しました`);
        }

        // パネルがなくなった場合、「データなし」メッセージを表示
        const panelsContainer = document.getElementById('sensor-panels');
        if (panelsContainer && Object.keys(this.sensorPanels).length === 0) {
            panelsContainer.innerHTML = '<p class="no-data">ロボットが選択されていません</p>';
        }
    }

    /**
     * ダッシュボードの表示/非表示を切り替え
     */
    toggleDashboard() {
        const dashboard = document.getElementById('sensor-dashboard');
        const toggleBtn = document.getElementById('toggle-dashboard');
        
        if (!dashboard || !toggleBtn) return;
        
        this.isCollapsed = !this.isCollapsed;
        
        if (this.isCollapsed) {
            dashboard.classList.add('collapsed');
            toggleBtn.textContent = '▲';
            toggleBtn.title = '展開';
        } else {
            dashboard.classList.remove('collapsed');
            toggleBtn.textContent = '▼';
            toggleBtn.title = '最小化';
        }
    }

    /**
     * クリーンアップ処理
     */
    cleanup() {
        const dashboard = document.getElementById('sensor-dashboard');
        if (dashboard) {
            dashboard.remove();
        }
        
        this.sensorPanels = {};
        console.log('🧹 センサーダッシュボードをクリーンアップしました');
    }
}