// Firebase SDKから必要な関数をインポートします
// ★★★ 認証関連の機能を追加でインポート ★★★
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
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
const auth = getAuth(app); // ★★★ Authサービスを取得 ★★★

// グローバルスコープに関数を定義
window.handleRideButtonClick = async (docId, action) => {
    const newStatus = action === 'ride' ? '使用中' : 'アイドリング中';
    const robotDocRef = doc(db, "robots", docId);
    try {
        await updateDoc(robotDocRef, { status: newStatus });
        map.closePopup(); // InfoWindowを閉じる
    } catch (error) {
        console.error("状態更新エラー:", error);
    }
};

let map;
let activeMarkers = {};
let activeInfoWindow = null;

// Google Maps APIの読み込み完了後に呼び出される初期化関数
window.initMap = () => {
    const initialLocation = { lat: 36.5598, lng: 139.9088 };
    map = new google.maps.Map(document.getElementById("map"), {
        center: initialLocation,
        zoom: 17,
        mapId: "MOBILITY_MAP_STYLE"
    });
    
    // ★★★ 認証状態の監視を開始 ★★★
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // ユーザーが（匿名）ログインに成功した場合
            console.log("匿名認証に成功しました。UserID:", user.uid);
            // 認証が成功したら、Firestoreのデータ監視を開始する
            startRealtimeUpdates();
        } else {
            // ユーザーがまだログインしていない場合
            console.log("サインアウト状態です。匿名サインインを試みます...");
            signInAnonymously(auth).catch((error) => {
                console.error("匿名サインイン中にエラーが発生しました:", error);
            });
        }
    });
};

// Firestoreのリアルタイム更新を開始する関数
function startRealtimeUpdates() {
    const robotsCol = collection(db, 'robots');
    onSnapshot(robotsCol, (snapshot) => {
        console.log("データベースが更新されました！");
        // 変更があったドキュメントを効率的に処理
        snapshot.docChanges().forEach((change) => {
            const docId = change.doc.id;
            const robot = change.doc.data();

            if (change.type === "added" || change.type === "modified") {
                if (activeMarkers[docId]) activeMarkers[docId].map = null;
                createMarker(docId, robot);
            } else if (change.type === "removed") {
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

    let markerColor = '#2196F3';
    if (robot.status === '走行中') markerColor = '#4CAF50';
    if (robot.status === '使用中') markerColor = '#f59e0b';
    
    const pin = new google.maps.marker.PinElement({
        glyph: "🤖",
        background: markerColor,
        borderColor: '#FFFFFF',
        scale: 1.2
    });
    
    const position = { lat: robot.position.latitude, lng: robot.position.longitude };
    const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position,
        content: pin.element,
        title: robot.id,
    });
    
    marker.addListener('click', () => {
        if (activeInfoWindow) activeInfoWindow.close();
        activeInfoWindow = new google.maps.InfoWindow({ content: popupHtml });
        activeInfoWindow.open(map, marker);
    });
    
    activeMarkers[docId] = marker;
}
