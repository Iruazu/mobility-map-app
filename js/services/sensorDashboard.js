/**
 * sensorDashboard.js - Real-time sensor data display for Web UI
 * Complete Fixed Version
 */

export class SensorDashboard {
    constructor(mapService) {
        this.mapService = mapService;
        this.sensorPanels = {};
        this.createDashboardUI();
    }

    /**
     * Create dashboard UI element
     */
    createDashboardUI() {
        // Check if dashboard already exists
        if (document.getElementById('sensor-dashboard')) return;

        const dashboard = document.createElement('div');
        dashboard.id = 'sensor-dashboard';
        dashboard.className = 'sensor-dashboard';
        dashboard.innerHTML = `
            <div class="dashboard-header">
                <h3>Robot Telemetry</h3>
                <button id="toggle-dashboard" class="toggle-btn">▼</button>
            </div>
            <div id="sensor-panels" class="sensor-panels">
                <p class="no-data">No robot selected</p>
            </div>
        `;

        document.body.appendChild(dashboard);

        // Toggle functionality
        document.getElementById('toggle-dashboard').addEventListener('click', () => {
            this.toggleDashboard();
        });
    }

    /**
     * Update sensor panel for a robot
     */
    updateRobotSensors(robotId, robotData) {
        const telemetry = robotData.telemetry || {};
        const panelsContainer = document.getElementById('sensor-panels');

        if (!panelsContainer) {
            console.error('Sensor panels container not found');
            return;
        }

        // Create panel if doesn't exist
        if (!this.sensorPanels[robotId]) {
            this.sensorPanels[robotId] = this.createSensorPanel(robotId, robotData);
            panelsContainer.innerHTML = ''; // Clear "no data" message
            panelsContainer.appendChild(this.sensorPanels[robotId]);
        }

        // Update panel content
        this.updatePanelContent(robotId, robotData, telemetry);
    }

    /**
     * Create sensor panel element
     */
    createSensorPanel(robotId, robotData) {
        const panel = document.createElement('div');
        panel.id = `sensor-panel-${robotId}`;
        panel.className = 'sensor-panel';
        panel.innerHTML = `
            <div class="panel-title">
                <span class="robot-name">${robotData.id || robotId}</span>
                <span class="status-indicator" id="status-${robotId}"></span>
            </div>
            
            <div class="sensor-grid">
                <!-- Battery -->
                <div class="sensor-item">
                    <div class="sensor-icon">🔋</div>
                    <div class="sensor-data">
                        <div class="sensor-label">Battery</div>
                        <div class="sensor-value" id="battery-${robotId}">--</div>
                        <div class="sensor-bar">
                            <div class="sensor-bar-fill" id="battery-bar-${robotId}" style="width: 0%"></div>
                        </div>
                    </div>
                </div>
                
                <!-- Speed -->
                <div class="sensor-item">
                    <div class="sensor-icon">⚡</div>
                    <div class="sensor-data">
                        <div class="sensor-label">Speed</div>
                        <div class="sensor-value" id="speed-${robotId}">--</div>
                    </div>
                </div>
                
                <!-- Distance to Goal -->
                <div class="sensor-item">
                    <div class="sensor-icon">🎯</div>
                    <div class="sensor-data">
                        <div class="sensor-label">Distance to Goal</div>
                        <div class="sensor-value" id="distance-${robotId}">--</div>
                    </div>
                </div>
                
                <!-- Obstacle Detection -->
                <div class="sensor-item">
                    <div class="sensor-icon">🚧</div>
                    <div class="sensor-data">
                        <div class="sensor-label">Obstacles</div>
                        <div class="sensor-value" id="obstacle-${robotId}">--</div>
                    </div>
                </div>
            </div>
        `;
        
        return panel;
    }

    /**
     * Update panel content with latest data
     */
    updatePanelContent(robotId, robotData, telemetry) {
        // Status indicator
        const statusEl = document.getElementById(`status-${robotId}`);
        if (statusEl) {
            const displayStatus = this.getStatusDisplayName(robotData.status);
            statusEl.textContent = displayStatus;
            statusEl.className = `status-indicator status-${this.getStatusClass(robotData.status)}`;
        }

        // Battery
        const batteryPercent = telemetry.battery_percent || 0;
        const batteryEl = document.getElementById(`battery-${robotId}`);
        const batteryBarEl = document.getElementById(`battery-bar-${robotId}`);
        
        if (batteryEl) {
            batteryEl.textContent = `${batteryPercent.toFixed(1)}%`;
            
            // Color coding
            if (batteryPercent > 50) {
                batteryEl.style.color = '#10b981';
            } else if (batteryPercent > 20) {
                batteryEl.style.color = '#f59e0b';
            } else {
                batteryEl.style.color = '#ef4444';
            }
        }
        
        if (batteryBarEl) {
            batteryBarEl.style.width = `${batteryPercent}%`;
            batteryBarEl.style.backgroundColor = batteryPercent > 20 ? '#10b981' : '#ef4444';
        }

        // Speed
        const speed = telemetry.speed || 0;
        const speedEl = document.getElementById(`speed-${robotId}`);
        if (speedEl) {
            speedEl.textContent = `${speed.toFixed(2)} m/s`;
        }

        // Distance to goal
        const distance = telemetry.distance_to_goal;
        const distanceEl = document.getElementById(`distance-${robotId}`);
        if (distanceEl) {
            if (distance !== null && distance !== undefined) {
                distanceEl.textContent = `${distance.toFixed(1)} m`;
                distanceEl.style.color = distance < 1 ? '#10b981' : '#6b7280';
            } else {
                distanceEl.textContent = 'No goal';
                distanceEl.style.color = '#9ca3af';
            }
        }

        // Obstacle detection
        const obstacleDetected = telemetry.obstacle_detected || false;
        const minDistance = telemetry.min_obstacle_distance;
        const obstacleEl = document.getElementById(`obstacle-${robotId}`);
        
        if (obstacleEl) {
            if (obstacleDetected) {
                obstacleEl.textContent = `⚠️ ${minDistance?.toFixed(2) || '?'} m`;
                obstacleEl.style.color = '#ef4444';
            } else {
                obstacleEl.textContent = 'Clear';
                obstacleEl.style.color = '#10b981';
            }
        }
    }

    /**
     * Get display name for status (English → Japanese)
     */
    getStatusDisplayName(status) {
        const statusMap = {
            'idle': 'アイドリング中',
            'in_use': '使用中',
            'moving': '走行中',
            'dispatching': '配車中'
        };
        return statusMap[status] || status;
    }

    /**
     * Get CSS class for status
     */
    getStatusClass(status) {
        const statusMap = {
            'idle': 'idle',
            'in_use': 'in-use',
            'moving': 'moving',
            'dispatching': 'dispatching'
        };
        return statusMap[status] || 'unknown';
    }

    /**
     * Remove sensor panel for robot
     */
    removeRobotPanel(robotId) {
        const panel = this.sensorPanels[robotId];
        if (panel && panel.parentNode) {
            panel.parentNode.removeChild(panel);
            delete this.sensorPanels[robotId];
        }

        // Show "no data" if no panels left
        const panelsContainer = document.getElementById('sensor-panels');
        if (panelsContainer && Object.keys(this.sensorPanels).length === 0) {
            panelsContainer.innerHTML = '<p class="no-data">No robot selected</p>';
        }
    }

    /**
     * Toggle dashboard visibility
     */
    toggleDashboard() {
        const dashboard = document.getElementById('sensor-dashboard');
        const toggleBtn = document.getElementById('toggle-dashboard');
        
        if (!dashboard || !toggleBtn) return;
        
        if (dashboard.classList.contains('collapsed')) {
            dashboard.classList.remove('collapsed');
            toggleBtn.textContent = '▼';
        } else {
            dashboard.classList.add('collapsed');
            toggleBtn.textContent = '▲';
        }
    }

    /**
     * Cleanup
     */
    cleanup() {
        const dashboard = document.getElementById('sensor-dashboard');
        if (dashboard) {
            dashboard.remove();
        }
        this.sensorPanels = {};
    }
}