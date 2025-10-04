import { createSvgIcon, createAdvancedMarker, createInfoWindow } from '../utils/geoUtils.js';

/**
 * 地図とマーカー管理サービス（完全版）
 * - 経路表示機能を削除（ROS2のNav2が実際の経路を計算）
 * - マーカー位置同期最適化
 */
export class MapService {
    constructor() {
        this.map = null;
        this.activeMarkers = {};
        this.activeInfoWindow = null;
        this.userMarker = null;
        this.mapClickCallback = null;
        
        // マーカー位置のキャッシュ
        this.lastMarkerPositions = {};
        
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

        // マーカーが既に存在する場合
        if (this.activeMarkers[docId]) {
            // 位置が変わっていない場合はスキップ
            if (!this.hasMarkerMoved(docId, newPosition)) {
                return;
            }
            
            // 位置が変わった場合のみマーカーを削除して再作成
            console.log(`🔄 ${robot.id}: マーカー位置更新`);
            const marker = this.activeMarkers[docId];
            marker.map = null;
            delete this.activeMarkers[docId];
        }

        // マーカーの作成
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
    }

    /**
     * マーカーが移動したかチェック
     */
    hasMarkerMoved(docId, newPosition) {
        const lastPosition = this.lastMarkerPositions[docId];
        if (!lastPosition) return true;

        // 許容誤差: 0.00001度 ≈ 1.1m
        const tolerance = 0.00001;
        const latDiff = Math.abs(newPosition.lat - lastPosition.lat);
        const lngDiff = Math.abs(newPosition.lng - lastPosition.lng);

        return latDiff > tolerance || lngDiff > tolerance;
    }
    
    /**
     * ロボットマーカーを更新する (エイリアス)
     */
    updateRobotMarker(docId, robot) {
        this.createRobotMarker(docId, robot);
    }
    
    /**
     * ロボットのポップアップHTMLを生成する
     */
    createRobotPopupHtml(docId, robot) {
        const status = robot.status; 
        let popupHtml;
        
        if (status === 'idle') {
            popupHtml = `
                <div class="p-1 font-sans">
                    <h3 class="font-bold text-md">${robot.id}</h3>
                    <p class="text-gray-700">状態: アイドリング中</p>
                    <button onclick="handleRideButtonClick('${docId}', 'ride')" 
                            class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded text-sm mt-2">
                        乗車する
                    </button>
                </div>`;
        } else if (status === 'in_use') {
            popupHtml = `
                <div class="p-1 font-sans">
                    <h3 class="font-bold text-md">${robot.id}</h3>
                    <p class="text-gray-700">状態: 使用中</p>
                    <p class="text-sm text-gray-500 mt-1">地図をクリックして目的地を設定</p>
                    <button onclick="handleRideButtonClick('${docId}', 'getoff')" 
                            class="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded text-sm mt-2">
                        降車する
                    </button>
                </div>`;
        } else if (status === 'moving') {
            popupHtml = `
                <div class="p-1 font-sans">
                    <h3 class="font-bold text-md">${robot.id}</h3>
                    <p class="text-gray-700">状態: 🚀 走行中</p>
                    <p class="text-sm text-gray-500 mt-1">ROS2が最適経路で移動中</p>
                </div>`;
        } else if (status === 'dispatching') {
            popupHtml = `
                <div class="p-1 font-sans">
                    <h3 class="font-bold text-md">${robot.id}</h3>
                    <p class="text-gray-700">状態: 🚕 配車中</p>
                    <p class="text-sm text-gray-500 mt-1">お迎えに向かっています</p>
                </div>`;
        } else {
            popupHtml = `
                <div class="p-1 font-sans">
                    <h3 class="font-bold text-md">${robot.id}</h3>
                    <p class="text-gray-700">状態: ${status}</p>
                </div>`;
        }
        return popupHtml;
    }

    /**
     * ロボットの状態に応じたマーカー色を取得
     */
    getRobotMarkerColor(status) {
        switch (status) {
            case 'moving': return '#4CAF50';
            case 'in_use': return '#f59e0b';
            case 'dispatching': return '#8b5cf6';
            default: return '#2196F3';
        }
    }

    /**
     * 乗車地点マーカーを設置する
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
            <div class="p-1 font-sans">
                <h3 class="font-bold text-md">乗車地点</h3>
                <p class="text-gray-600 text-sm">緯度: ${lat.toFixed(4)}, 経度: ${lng.toFixed(4)}</p>
                <button onclick="handleCallRobotClick(${lat}, ${lng})" 
                        class="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-2 rounded text-sm mt-2">
                    この場所にロボットを呼ぶ
                </button>
            </div>`;
        
        const infoWindow = createInfoWindow(popupHtml);
        this.userMarker.addListener('click', () => this.openInfoWindow(infoWindow, this.userMarker));
        this.openInfoWindow(infoWindow, this.userMarker);
    }

    /**
     * 目的地マーカーを設置する
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
            <div class="p-1 font-sans">
                <h3 class="font-bold text-md">目的地</h3>
                <p class="text-gray-600 text-sm">緯度: ${lat.toFixed(4)}, 経度: ${lng.toFixed(4)}</p>
                <p class="text-xs text-gray-500 mt-1">ROS2が最適経路を計算します</p>
                <button onclick="handleSetDestinationClick('${robotDocId}', ${lat}, ${lng})" 
                        class="bg-emerald-500 hover:bg-emerald-700 text-white font-bold py-1 px-2 rounded text-sm mt-2">
                    この場所へ行く
                </button>
            </div>`;

        const infoWindow = createInfoWindow(popupHtml);
        this.userMarker.addListener('click', () => this.openInfoWindow(infoWindow, this.userMarker));
        this.openInfoWindow(infoWindow, this.userMarker);
    }

    /**
     * InfoWindowを開く
     */
    openInfoWindow(infoWindow, anchor) {
        if (this.activeInfoWindow) this.activeInfoWindow.close();
        infoWindow.open(this.map, anchor);
        this.activeInfoWindow = infoWindow;
    }

    /**
     * マーカーを削除する
     */
    removeMarker(docId) {
        if (this.activeMarkers[docId]) {
            this.activeMarkers[docId].map = null;
            delete this.activeMarkers[docId];
            delete this.lastMarkerPositions[docId];
        }
    }

    /**
     * ユーザーマーカーを削除する
     */
    removeUserMarker() {
        if (this.userMarker) {
            this.userMarker.map = null;
            this.userMarker = null;
        }
    }

    /**
     * 🚨 経路表示機能は削除
     * ROS2のNav2がSimulation環境で実際の経路を計算するため、
     * Web側での経路表示は意味がありません
     */
}