// Firebase SDKから必要な関数をインポート（読み込み）します
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// ユーザーが取得した、ウェブアプリのFirebase設定
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
// Firestoreデータベースへの参照を取得
const db = getFirestore(app);


// --- ここから下が地図の描画とリアルタイム更新の処理です ---

// 地図の初期化処理
const initialLocation = [36.5598, 139.9088];
const zoomLevel = 17;
const map = L.map('map').setView(initialLocation, zoomLevel);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// 表示中のマーカーを保持するためのレイヤーグループ
const markersLayer = L.layerGroup().addTo(map);

// "robots" コレクションへの参照を取得
const robotsCol = collection(db, 'robots');

// "robots" コレクションの変更をリアルタイムで監視する
// データが追加・更新・削除されるたびに、この中の処理が自動で実行されます
onSnapshot(robotsCol, (snapshot) => {
    console.log("データベースが更新されました！");
    
    // 古いマーカーをすべて削除
    markersLayer.clearLayers();

    // 取得したドキュメント（ロボットのデータ）一つ一つに対して処理を行う
    snapshot.docs.forEach((doc) => {
        const robot = doc.data(); // ドキュメントのデータを取得

        // positionデータが存在しない場合は処理をスキップ
        if (!robot.position || !robot.position.latitude || !robot.position.longitude) {
            console.warn("位置情報(position)が不正なデータが見つかりました:", robot.id);
            return; 
        }

        // ポップアップのHTMLコンテンツを作成
        const contentString = `
            <div class="p-1">
                <h3 class="font-bold text-md">${robot.id}</h3>
                <p class="text-gray-700">状態: ${robot.status}</p>
            </div>`;
        
        // カスタムアイコンを作成
        const iconHtml = `<div style="
            background-color: ${robot.status === '走行中' ? '#4CAF50' : '#2196F3'}; 
            border-radius: 50%; width: 30px; height: 30px; display: flex; 
            justify-content: center; align-items: center; color: white; 
            font-size: 18px; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);">🤖</div>`;
        const customIcon = L.divIcon({
            html: iconHtml, className: '', iconSize: [30, 30], iconAnchor: [15, 15]
        });

        // FirestoreのgeopointからLeafletで使える緯度経度の配列に変換
        const position = [robot.position.latitude, robot.position.longitude];

        // マーカーを作成してレイヤーに追加
        const marker = L.marker(position, {icon: customIcon});
        marker.bindPopup(contentString);
        markersLayer.addLayer(marker);
    });
});
