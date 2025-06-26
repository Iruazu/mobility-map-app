// Firebase SDKから必要な関数をインポートします
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, updateDoc, getDocs, GeoPoint } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

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
const auth = getAuth(app);

// グローバルスコープに関数を定義
// ロボットの「乗車/降車」ボタンがクリックされたときの処理
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

// 「ロボットを呼ぶ」ボタンがクリックされたときの処理
window.handleCallRobotClick = async (lat, lng) => {
    console.log(`配車リクエスト発生！ 場所: (${lat}, ${lng})`);
    
    // 1. 利用可能なロボットを探す
    const robotsCol = collection(db, 'robots');
    const robotSnapshot = await getDocs(robotsCol);
    
    let closestRobot = null;
    let minDistance = Infinity;

    robotSnapshot.forEach((doc) => {
        const robot = doc.data();
        if (robot.status === 'アイドリング中') {
            const distance = getDistance(
                { lat: lat, lng: lng },
                { lat: robot.position.latitude, lng: robot.position.longitude }
            );
            if (distance < minDistance) {
                minDistance = distance;
                closestRobot = { id: doc.id, ...robot };
            }
        }
    });

    if (!closestRobot) {
        alert("現在、利用可能なロボットがいません。");
        return;
    }
    
    console.log(`最も近いロボットが見つかりました: ${closestRobot.id} (距離: ${minDistance.toFixed(2)} km)`);
    
    // 2. ロボットの状態を更新し、目的地を設定
    const robotDocRef = doc(db, "robots", closestRobot.id);
    const destinationGeoPoint = new GeoPoint(lat, lng);
    await updateDoc(robotDocRef, {
        status: '配車中',
        destination: destinationGeoPoint
    });

    // 3. 経路を計算して地図に描画
    calculateAndDisplayRoute(closestRobot.position, { lat, lng });
};


let map;
let activeMarkers = {}; // ロボットのマーカーを保持
let activeInfoWindow = null;
let userMarker = null; // ユーザーマーカーを保持するための変数
let directionsRenderer = null; // 経路表示用のレンダラーを保持する変数

// Google Maps APIの読み込み完了後に呼び出される初期化関数
window.initMap = () => {
    const initialLocation = { lat: 36.5598, lng: 139.9088 };
    map = new google.maps.Map(document.getElementById("map"), {
        center: initialLocation,
        zoom: 17,
        mapId: "MOBILITY_MAP_STYLE"
    });
    
    map.addListener('click', (event) => {
        placeUserMarker(event.latLng);
    });

    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("匿名認証に成功しました。UserID:", user.uid);
            startRealtimeUpdates();
        } else {
            console.log("サインアウト状態です。匿名サインインを試みます...");
            signInAnonymously(auth).catch((error) => {
                console.error("匿名サインイン中にエラーが発生しました:", error);
            });
        }
    });
};

// 2点間の距離を計算する関数 (Haversine formula)
function getDistance(pos1, pos2) {
    const R = 6371; // 地球の半径 (km)
    const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
    const dLng = (pos2.lng - pos1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(pos1.lat * Math.PI / 180) * Math.cos(pos2.lat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// 経路を計算・表示するための新しい関数
function calculateAndDisplayRoute(origin, destination) {
    if (directionsRenderer) {
        directionsRenderer.setMap(null);
    }
    
    const directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        suppressMarkers: true,
        polylineOptions: {
            strokeColor: '#0000FF',
            strokeOpacity: 0.8,
            strokeWeight: 6
        }
    });
    directionsRenderer.setMap(map);

    directionsService.route(
        {
            origin: { lat: origin.latitude, lng: origin.longitude },
            destination: destination,
            travelMode: google.maps.TravelMode.DRIVING,
        },
        (response, status) => {
            if (status === "OK") {
                directionsRenderer.setDirections(response);
            } else {
                window.alert("経路情報の取得に失敗しました: " + status);
            }
        }
    );
}

// ユーザーマーカーを設置するための新しい関数
function placeUserMarker(location) {
    if (userMarker) {
        userMarker.map = null;
    }

    const userPin = new google.maps.marker.PinElement({
        glyph: "👤",
        background: "#9333ea",
        borderColor: "#FFFFFF",
        scale: 1.2,
    });

    userMarker = new google.maps.marker.AdvancedMarkerElement({
        position: location,
        map: map,
        content: userPin.element,
        title: "あなたの現在地"
    });

    const lat = location.lat();
    const lng = location.lng();
    const popupHtml = `
        <div class="p-1 font-sans">
            <h3 class="font-bold text-md">乗車地点</h3>
            <p class="text-gray-600 text-sm">緯度: ${lat.toFixed(4)}</p>
            <p class="text-gray-600 text-sm mb-2">経度: ${lng.toFixed(4)}</p>
            <button onclick="handleCallRobotClick(${lat}, ${lng})" class="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-2 rounded text-sm">この場所にロボットを呼ぶ</button>
        </div>`;
    
    const infoWindow = new google.maps.InfoWindow({ content: popupHtml });
    userMarker.addListener('click', () => {
        if (activeInfoWindow) activeInfoWindow.close();
        infoWindow.open(map, userMarker);
        activeInfoWindow = infoWindow;
    });

    infoWindow.open(map, userMarker);
    activeInfoWindow = infoWindow;
}

// Firestoreのリアルタイム更新を開始する関数
function startRealtimeUpdates() {
    const robotsCol = collection(db, 'robots');
    onSnapshot(robotsCol, (snapshot) => {
        console.log("データベースが更新されました！");
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

    let markerColor = '#2196F3'; // アイドリング中
    if (robot.status === '走行中') markerColor = '#4CAF50';
    if (robot.status === '使用中') markerColor = '#f59e0b';
    if (robot.status === '配車中') markerColor = '#EAB308'; // 黄色
    
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
        const infoWindow = new google.maps.InfoWindow({ content: popupHtml });
        infoWindow.open(map, marker);
        activeInfoWindow = infoWindow;
    });
    
    activeMarkers[docId] = marker;
}
