// Firebase SDKから必要な関数をインポートします
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// ウェブアプリのFirebase設定
const firebaseConfig = {
    apiKey: "AIzaSyDW1WMrrgv-pg0lJwgR3G__R4xxtnQpevY",
    authDomain: "mobility-map-ae58e.firebaseapp.com",
    projectId: "mobility-map-ae58e",
    storageBucket: "mobility-map-ae58e.appspot.com",
    messagingSenderId: "714590381625",
    appId: "1:714590381625:web:fea8e2f819cba4a243cfe8",
    measurementId: "G-PQ21YKP1VP"
};

// Firebaseを初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ★★★ ここからがGoogle Maps版のコードです ★★★

// グローバルスコープに関数を定義
// HTMLのonclickから呼び出せるようにするため
window.handleRideButtonClick = async (docId, action) => {
    const newStatus = action === 'ride' ? '使用中' : 'アイドリング中';
    const robotDocRef = doc(db, "robots", docId);
    try {
        await updateDoc(robotDocRef, { status: newStatus });
    } catch (error) {
        console.error("状態更新エラー:", error);
    }
};

let map; // mapオブジェクトをグローバルスコープで保持
let activeMarkers = {}; // 表示中のマーカーを保持するオブジェクト
let activeInfoWindow = null; // 表示中の情報ウィンドウを保持

// Google Maps APIの読み込み完了後に呼び出される初期化関数
window.initMap = () => {
    const initialLocation = { lat: 36.5598, lng: 139.9088 };
    const zoomLevel = 17;

    map = new google.maps.Map(document.getElementById("map"), {
        center: initialLocation,
        zoom: zoomLevel,
        mapId: "MOBILITY_MAP_STYLE" // カスタムスタイル用のID
    });

    const robotsCol = collection(db, 'robots');
    
    // Firestoreのリアルタイム監視を開始
    onSnapshot(robotsCol, (snapshot) => {
        console.log("データベースが更新されました！");
        
        // 変更があったドキュメントを効率的に処理
        snapshot.docChanges().forEach((change) => {
            const docId = change.doc.id;
            const robot = change.doc.data();

            if (change.type === "added" || change.type === "modified") {
                // 既存のマーカーがあれば削除
                if (activeMarkers[docId]) {
                    activeMarkers[docId].map = null;
                }
                // 新しいマーカーを作成・表示
                createMarker(docId, robot);
            } else if (change.type === "removed") {
                // マーカーを削除
                if (activeMarkers[docId]) {
                    activeMarkers[docId].map = null;
                    delete activeMarkers[docId];
                }
            }
        });
    });
}

// マーカーを作成する関数
function createMarker(docId, robot) {
    if (!robot.position?.latitude || !robot.position?.longitude) return;

    // ポップアップ（InfoWindow）の中身を生成
    let popupHtml = `
        <div class="p-1 font-sans">
            <h3 class="font-bold text-md">${robot.id}</h3>
            <p class="text-gray-700">状態: ${robot.status}</p>
    `;
    if (robot.status === 'アイドリング中') {
        popupHtml += `<button onclick="handleRideButtonClick('${docId}', 'ride')" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded text-sm mt-2">乗車する</button>`;
    } else if (robot.status === '使用中') {
        popupHtml += `<button onclick="handleRideButtonClick('${docId}', 'getoff')" class="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded text-sm mt-2">降車する</button>`;
    }
    popupHtml += `</div>`;

    // マーカーの色を決定
    let markerColor = '#2196F3'; // デフォルトは青 (アイドリング中)
    if (robot.status === '走行中') markerColor = '#4CAF50';
    if (robot.status === '使用中') markerColor = '#f59e0b';

    // カスタムマーカー用のHTML要素を作成
    const glyph = document.createElement("div");
    glyph.innerHTML = '🤖';
    glyph.className = 'text-xl';
    
    const pin = new google.maps.marker.PinElement({
        glyph: glyph,
        background: markerColor,
        borderColor: '#FFFFFF',
        scale: 1.2
    });
    
    const position = { lat: robot.position.latitude, lng: robot.position.longitude };

    // マーカーを作成
    const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position,
        content: pin.element,
        title: robot.id,
    });
    
    // マーカークリック時の処理
    marker.addListener('click', () => {
        // 既存の情報ウィンドウがあれば閉じる
        if (activeInfoWindow) {
            activeInfoWindow.close();
        }
        // 新しい情報ウィンドウを作成して表示
        activeInfoWindow = new google.maps.InfoWindow({ content: popupHtml });
        activeInfoWindow.open(map, marker);
    });
    
    // 作成したマーカーを保持
    activeMarkers[docId] = marker;
}
