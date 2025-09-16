/**
 * 2点間の距離を計算する関数（単位：km）
 * @param {Object} pos1 - 位置1 {lat: number, lng: number}
 * @param {Object} pos2 - 位置2 {lat: number, lng: number}
 * @returns {number} 距離（km）
 */
export function getDistance(pos1, pos2) {
    const R = 6371; // 地球の半径（km）
    const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
    const dLng = (pos2.lng - pos1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(pos1.lat * Math.PI / 180) * Math.cos(pos2.lat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * SVGアイコンを作成する関数
 * @param {string} type - アイコンタイプ（'person'など）
 * @returns {HTMLElement} SVGアイコン要素
 */
export function createSvgIcon(type) {
    const svgData = {
        person: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white">
                   <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                 </svg>`
    };
    const element = document.createElement('div');
    element.innerHTML = svgData[type];
    return element;
}

/**
 * AdvancedMarkerElementを作成するヘルパー関数
 * @param {Object} position - 位置 {lat: number, lng: number}
 * @param {HTMLElement} content - マーカーの内容
 * @param {string} title - マーカーのタイトル
 * @param {google.maps.Map} map - Googleマップインスタンス
 * @returns {google.maps.marker.AdvancedMarkerElement}
 */
export function createAdvancedMarker(position, content, title, map) {
    return new google.maps.marker.AdvancedMarkerElement({ 
        position, 
        map, 
        content, 
        title 
    });
}

/**
 * InfoWindowを作成するヘルパー関数
 * @param {string} content - ウィンドウの内容
 * @returns {google.maps.InfoWindow}
 */
export function createInfoWindow(content) {
    return new google.maps.InfoWindow({ content });
}