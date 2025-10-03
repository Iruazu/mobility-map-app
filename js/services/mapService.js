import { createSvgIcon, createAdvancedMarker, createInfoWindow } from '../utils/geoUtils.js';

/**
 * 地図とマーカー管理サービス
 */
export class MapService {
    constructor() {
        this.map = null;
        this.activeMarkers = {};
        this.activeInfoWindow = null;
        this.userMarker = null;
        this.directionsRenderer = null;
        this.mapClickCallback = null;
        
        // 🚀 修正点 1: this のコンテキストを固定するためにメソッドをバインド
        this.openInfoWindow = this.openInfoWindow.bind(this);
    }

    /**
     * 地図を初期化する
     * @param {string} elementId - 地図を表示する要素のID
     * @param {Function} onMapClick - 地図クリック時のコールバック関数
     */
    initializeMap(elementId, onMapClick) {
        const initialLocation = { lat: 36.5598, lng: 139.9088 };
        this.map = new google.maps.Map(document.getElementById(elementId), {
            center: initialLocation,
            zoom: 17,
            mapId: "MOBILITY_MAP_STYLE"
        });
        
        this.mapClickCallback = onMapClick;
        this.map.addListener('click', (event) => {
            this.mapClickCallback(event.latLng);
        });
    }

    /**
     * ロボットマーカーを作成・更新する (作成と更新を兼ねる実体メソッド)
     * @param {string} docId - ドキュメントID
     * @param {Object} robot - ロボットデータ
     */
    createRobotMarker(docId, robot) {
        if (!robot.position?.latitude || !robot.position?.longitude) {
            console.warn(`ロボット ${robot.id} の位置情報が不正です`);
            return;
        }

        // マーカーが存在する場合、位置とアイコンを更新するロジック
        if (this.activeMarkers[docId]) {
            const marker = this.activeMarkers[docId];
            
            // AdvancedMarkerElementは位置の直接更新が困難なため、削除・再作成で対応
            marker.map = null;
            delete this.activeMarkers[docId];
        }

        // マーカーの作成/再作成
        const popupHtml = this.createRobotPopupHtml(docId, robot);
        const markerColor = this.getRobotMarkerColor(robot.status);
        
        const pin = new google.maps.marker.PinElement({
            glyph: "🤖",
            background: markerColor,
            borderColor: '#FFFFFF',
            scale: 1.2
        });
        
        const position = { lat: robot.position.latitude, lng: robot.position.longitude };
        const newMarker = createAdvancedMarker(position, pin.element, robot.id, this.map);
        
        const infoWindow = createInfoWindow(popupHtml);
        // 🚀 修正点 2: バインドされた openInfoWindow を使用
        newMarker.addListener('click', () => this.openInfoWindow(infoWindow, newMarker)); 
        
        this.activeMarkers[docId] = newMarker;
    }
    
    /**
     * ロボットマーカーを更新する (robotService.js のエラー解消用エイリアス)
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
                    <p class="text-gray-700">状態: ${status}</p>
                    <button onclick="handleRideButtonClick('${docId}', 'ride')" 
                            class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded text-sm mt-2">
                        乗車する
                    </button>
                </div>`;
        } else if (status === 'in_use') {
            popupHtml = `
                <div class="p-1 font-sans">
                    <h3 class="font-bold text-md">${robot.id}</h3>
                    <p class="text-gray-700">状態: ${status}</p>
                    <p class="text-sm text-gray-500 mt-1">地図をクリックして目的地を設定</p>
                    <button onclick="handleRideButtonClick('${docId}', 'getoff')" 
                            class="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded text-sm mt-2">
                        降車する
                    </button>
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
            case 'dispatching': return '#EAB308';
            default: return '#2196F3'; // idle
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
     * @param {google.maps.InfoWindow} infoWindow - InfoWindow
     * @param {google.maps.marker.AdvancedMarkerElement} anchor - アンカー
     */
    openInfoWindow(infoWindow, anchor) { // 🚨 このメソッドは constructor でバインドされています
        if (this.activeInfoWindow) this.activeInfoWindow.close();
        infoWindow.open(this.map, anchor);
        this.activeInfoWindow = infoWindow;
    }

    /**
     * 経路を表示する
     */
    displayRoute(origin, destination, onRouteCalculated) {
        if (this.directionsRenderer) this.directionsRenderer.setMap(null);
        
        const directionsService = new google.maps.DirectionsService();
        this.directionsRenderer = new google.maps.DirectionsRenderer({
            suppressMarkers: true,
            polylineOptions: { strokeColor: '#0000FF', strokeOpacity: 0.8, strokeWeight: 6 }
        });
        this.directionsRenderer.setMap(this.map);

        directionsService.route(
            {
                origin: { lat: origin.latitude, lng: origin.longitude },
                destination: destination,
                travelMode: google.maps.TravelMode.DRIVING,
            },
            (response, status) => {
                if (status === "OK") {
                    this.directionsRenderer.setDirections(response);
                    const path = response.routes[0].overview_path;
                    onRouteCalculated(path);
                } else {
                    console.error("Directions request failed: " + status, response);
                    alert("経路情報の取得に失敗しました: " + status);
                }
            }
        );
    }

    /**
     * マーカーを削除する
     */
    removeMarker(docId) {
        if (this.activeMarkers[docId]) {
            this.activeMarkers[docId].map = null;
            delete this.activeMarkers[docId];
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
     * 経路表示を削除する
     */
    clearRoute() {
        if (this.directionsRenderer) {
            this.directionsRenderer.setMap(null);
            this.directionsRenderer = null;
        }
    }
}