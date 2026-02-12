import { createSvgIcon, createAdvancedMarker, createInfoWindow } from '../utils/geoUtils.js';

/**
 * 地図とマーカー管理サービス（UI刷新版）
 * - モダンなInfoWindowポップアップ
 * - UIServiceとの連携（ロボットリスト・ステータスバー）
 */
export class MapService {
    constructor() {
        this.map = null;
        this.activeMarkers = {};
        this.activeInfoWindow = null;
        this.userMarker = null;
        this.mapClickCallback = null;

        this.lastMarkerPositions = {};
        this.lastMarkerStatuses = {};

        this.openInfoWindow = this.openInfoWindow.bind(this);
    }

    /**
     * 地図を初期化する
     */
    initializeMap(elementId, onMapClick) {
        const initialLocation = { lat: 36.55077, lng: 139.92957 };
        this.map = new google.maps.Map(document.getElementById(elementId), {
            center: initialLocation,
            zoom: 17,
            mapId: "MOBILITY_MAP_STYLE"
        });

        this.mapClickCallback = onMapClick;
        this.map.addListener('click', (event) => {
            this.mapClickCallback(event.latLng);
        });

        console.log('🗺️ Google Maps初期化完了');
    }

    /**
     * ロボットマーカーを作成・更新する
     */
    createRobotMarker(docId, robot) {
        if (!robot.position?.latitude || !robot.position?.longitude) {
            console.warn(`⚠️ ロボット ${robot.id} の位置情報が不正です`);
            return;
        }

        const newPosition = {
            lat: robot.position.latitude,
            lng: robot.position.longitude
        };

        if (this.activeMarkers[docId]) {
            const marker = this.activeMarkers[docId];

            const positionChanged = this.hasMarkerMoved(docId, newPosition);
            const statusChanged = this.hasStatusChanged(docId, robot.status);

            if (!positionChanged && !statusChanged) {
                return;
            }

            if (positionChanged) {
                console.log(`🔄 ${robot.id}: マーカー位置更新`);
            }
            if (statusChanged) {
                console.log(`🔄 ${robot.id}: マーカーステータス更新 → ${robot.status}`);
            }

            marker.map = null;
            delete this.activeMarkers[docId];
        }

        const popupHtml = this.createRobotPopupHtml(docId, robot);
        const markerColor = this.getRobotMarkerColor(robot.status);

        const pin = new google.maps.marker.PinElement({
            glyph: "🤖",
            background: markerColor,
            borderColor: '#FFFFFF',
            scale: 1.2
        });

        const newMarker = createAdvancedMarker(newPosition, pin.element, robot.id, this.map);

        const infoWindow = createInfoWindow(popupHtml);
        newMarker.addListener('click', () => this.openInfoWindow(infoWindow, newMarker));

        this.activeMarkers[docId] = newMarker;
        this.lastMarkerPositions[docId] = newPosition;
        this.lastMarkerStatuses[docId] = robot.status;
    }

    hasMarkerMoved(docId, newPosition) {
        const lastPosition = this.lastMarkerPositions[docId];
        if (!lastPosition) return true;
        const tolerance = 0.00001;
        const latDiff = Math.abs(newPosition.lat - lastPosition.lat);
        const lngDiff = Math.abs(newPosition.lng - lastPosition.lng);
        return latDiff > tolerance || lngDiff > tolerance;
    }

    hasStatusChanged(docId, newStatus) {
        const lastStatus = this.lastMarkerStatuses[docId];
        if (!lastStatus) return true;
        return newStatus !== lastStatus;
    }

    updateRobotMarker(docId, robot) {
        this.createRobotMarker(docId, robot);
    }

    /**
     * ロボットのポップアップHTML（モダンデザイン版）
     */
    createRobotPopupHtml(docId, robot) {
        const status = robot.status;
        const statusLabels = {
            idle: 'アイドリング中',
            in_use: '使用中',
            moving: '走行中',
            dispatching: '配車中'
        };
        const statusColors = {
            idle: '#3b82f6',
            in_use: '#f59e0b',
            moving: '#10b981',
            dispatching: '#8b5cf6'
        };
        const statusIcons = {
            idle: '🟦',
            in_use: '🟧',
            moving: '🟩',
            dispatching: '🟪'
        };

        const label = statusLabels[status] || status;
        const color = statusColors[status] || '#6b7280';
        const icon = statusIcons[status] || '⬜';

        let actionHtml = '';
        let detailHtml = '';

        if (status === 'idle') {
            actionHtml = `
                <button onclick="handleRideButtonClick('${docId}', 'ride')" 
                        class="info-popup-btn ride">
                    🚐 乗車する
                </button>`;
        } else if (status === 'in_use') {
            detailHtml = `<div class="info-popup-detail">💡 地図をクリックして目的地を設定</div>`;
            actionHtml = `
                <button onclick="handleRideButtonClick('${docId}', 'getoff')" 
                        class="info-popup-btn getoff">
                    🛑 降車する
                </button>`;
        } else if (status === 'moving') {
            detailHtml = `<div class="info-popup-detail">🚀 ROS2が最適経路で移動中</div>`;
        } else if (status === 'dispatching') {
            detailHtml = `<div class="info-popup-detail">🚕 お迎えに向かっています</div>`;
        }

        return `
            <div class="info-popup">
                <div class="info-popup-header">
                    <span class="info-popup-name">${robot.id}</span>
                    <span class="info-popup-badge" style="background-color:${color}">${icon} ${label}</span>
                </div>
                ${detailHtml}
                ${actionHtml}
            </div>`;
    }

    getRobotMarkerColor(status) {
        switch (status) {
            case 'moving': return '#10b981';
            case 'in_use': return '#f59e0b';
            case 'dispatching': return '#8b5cf6';
            default: return '#3b82f6';
        }
    }

    /**
     * 乗車地点マーカー（モダンデザイン版）
     */
    placePickupMarker(location) {
        if (this.userMarker) this.userMarker.map = null;

        const userPin = new google.maps.marker.PinElement({
            glyph: createSvgIcon("person"),
            background: "#9333ea",
            borderColor: "#FFFFFF",
            scale: 1.2,
        });
        this.userMarker = createAdvancedMarker(location, userPin.element, "乗車地点", this.map);

        const lat = location.lat();
        const lng = location.lng();
        const popupHtml = `
            <div class="info-popup">
                <div class="info-popup-header">
                    <span class="info-popup-name">📍 乗車地点</span>
                </div>
                <div class="info-popup-detail">緯度: ${lat.toFixed(4)}, 経度: ${lng.toFixed(4)}</div>
                <button onclick="handleCallRobotClick(${lat}, ${lng})" 
                        class="info-popup-btn call">
                    🚕 この場所にロボットを呼ぶ
                </button>
            </div>`;

        const infoWindow = createInfoWindow(popupHtml);
        this.userMarker.addListener('click', () => this.openInfoWindow(infoWindow, this.userMarker));
        this.openInfoWindow(infoWindow, this.userMarker);
    }

    /**
     * 目的地マーカー（モダンデザイン版）
     */
    placeDestinationMarker(location, robotDocId) {
        if (this.userMarker) this.userMarker.map = null;

        const destPin = new google.maps.marker.PinElement({
            glyph: "🏁",
            background: "#10b981",
            borderColor: "#FFFFFF",
            scale: 1.2,
        });
        this.userMarker = createAdvancedMarker(location, destPin.element, "目的地", this.map);

        const lat = location.lat();
        const lng = location.lng();
        const popupHtml = `
            <div class="info-popup">
                <div class="info-popup-header">
                    <span class="info-popup-name">🏁 目的地</span>
                </div>
                <div class="info-popup-detail">緯度: ${lat.toFixed(4)}, 経度: ${lng.toFixed(4)}</div>
                <div class="info-popup-detail" style="font-size:0.7rem;color:#9ca3af;">ROS2が最適経路を計算します</div>
                <button onclick="handleSetDestinationClick('${robotDocId}', ${lat}, ${lng})" 
                        class="info-popup-btn destination">
                    🏁 この場所へ行く
                </button>
            </div>`;

        const infoWindow = createInfoWindow(popupHtml);
        this.userMarker.addListener('click', () => this.openInfoWindow(infoWindow, this.userMarker));
        this.openInfoWindow(infoWindow, this.userMarker);
    }

    openInfoWindow(infoWindow, anchor) {
        if (this.activeInfoWindow) this.activeInfoWindow.close();
        infoWindow.open(this.map, anchor);
        this.activeInfoWindow = infoWindow;
    }

    removeMarker(docId) {
        if (this.activeMarkers[docId]) {
            this.activeMarkers[docId].map = null;
            delete this.activeMarkers[docId];
            delete this.lastMarkerPositions[docId];
            delete this.lastMarkerStatuses[docId];
        }
    }

    removeUserMarker() {
        if (this.userMarker) {
            this.userMarker.map = null;
            this.userMarker = null;
        }
    }
}