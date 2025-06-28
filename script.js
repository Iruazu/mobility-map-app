// Firebase SDKから必要な関数をインポートします
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, updateDoc, getDoc, getDocs, GeoPoint, deleteField } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

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

// --- グローバル関数定義 ---

// ロボットの「乗車/降車」ボタンがクリックされたときの処理
window.handleRideButtonClick = async (docId, action) => {
    const robotDocRef = doc(db, "robots", docId);
    if (action === 'ride') {
        await updateDoc(robotDocRef, { status: '使用中' });
        if (userMarker) userMarker.map = null; // 乗車したらユーザーマーカーを消す
    } else { // getoff
        await updateDoc(robotDocRef, { status: 'アイドリング中' });
    }
    if (activeInfoWindow) activeInfoWindow.close();
};

// 「ロボットを呼ぶ」ボタンがクリックされたときの処理
window.handleCallRobotClick = async (lat, lng) => {
    console.log(`配車リクエスト発生！ 場所: (${lat}, ${lng})`);
    
    const robotsCol = collection(db, 'robots');
    const robotSnapshot = await getDocs(robotsCol);
    let closestRobot = null;
    let minDistance = Infinity;

    robotSnapshot.forEach((doc) => {
        const robot = doc.data();
        if (robot.status === 'アイドリング中') {
            const distance = getDistance(
                { lat, lng },
                { lat: robot.position.latitude, lng: robot.position.longitude }
            );
            if (distance < minDistance) {
                minDistance = distance;
                closestRobot = { docId: doc.id, data: robot };
            }
        }
    });

    if (!closestRobot) {
        alert("現在、利用可能なロボットがいません。");
        return;
    }
    
    console.log(`最も近いロボットが見つかりました: ${closestRobot.data.id}`);
    
    const robotDocRef = doc(db, "robots", closestRobot.docId);
    await updateDoc(robotDocRef, {
        status: '配車中',
        destination: new GeoPoint(lat, lng)
    });

    calculateAndDisplayRoute(closestRobot.docId, closestRobot.data.position, { lat, lng });
};

// 「この場所へ行く」ボタンがクリックされたときの処理
window.handleSetDestinationClick = async (robotDocId, lat, lng) => {
    console.log(`目的地設定！ ロボットID: ${robotDocId}, 場所: (${lat}, ${lng})`);
    
    const robotDocRef = doc(db, "robots", robotDocId);
    const robotDoc = await getDoc(robotDocRef);
    if (!robotDoc.exists()) return;

    const currentPosition = robotDoc.data().position;
    const destination = { lat, lng };

    // ロボットの状態を「走行中」にし、最終目的地を設定
    await updateDoc(robotDocRef, {
        status: '走行中',
        destination: new GeoPoint(destination.lat, destination.lng)
    });

    // 現在地から最終目的地までの経路を計算・表示
    calculateAndDisplayRoute(robotDocId, currentPosition, destination);
};


let map;
let activeMarkers = {};
let activeInfoWindow = null;
let userMarker = null; // 乗車位置マーカーまたは目的地マーカー
let directionsRenderer = null;
const activeSimulations = {}; 

window.initMap = () => {
    const initialLocation = { lat: 36.5598, lng: 139.9088 };
    map = new google.maps.Map(document.getElementById("map"), {
        center: initialLocation,
        zoom: 17,
        mapId: "MOBILITY_MAP_STYLE"
    });
    
    // 地図クリック時の処理を handleMapClick に集約
    map.addListener('click', (event) => {
        handleMapClick(event.latLng);
    });

    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("匿名認証に成功しました。UserID:", user.uid);
            startRealtimeUpdates();
        } else {
            signInAnonymously(auth).catch((error) => console.error("匿名サインインエラー:", error));
        }
    });
};

// 地図クリック時のメイン処理関数
async function handleMapClick(location) {
    // 現在「使用中」のロボットがいるか確認
    const robotsCol = collection(db, 'robots');
    const robotSnapshot = await getDocs(robotsCol);
    const inUseRobotDoc = robotSnapshot.docs.find(doc => doc.data().status === '使用中');

    if (inUseRobotDoc) {
        // 「使用中」のロボットがいる場合 -> 目的地を設定する
        console.log("目的地設定モードです。");
        placeDestinationMarker(location, inUseRobotDoc.id);
    } else {
        // 「使用中」のロボットがいない場合 -> ロボットを呼ぶ
        console.log("配車リクエストモードです。");
        placePickupMarker(location);
    }
}

// ユーザーの乗車位置マーカーを設置する関数 (旧 placeUserMarker)
function placePickupMarker(location) {
    if (userMarker) userMarker.map = null;

    const userPin = new google.maps.marker.PinElement({
        glyph: createSvgIcon("person"),
        background: "#9333ea",
        borderColor: "#FFFFFF",
        scale: 1.2,
    });
    userMarker = createAdvancedMarker(location, userPin.element, "乗車地点");
    
    const lat = location.lat();
    const lng = location.lng();
    const popupHtml = `
        <div class="p-1 font-sans">
            <h3 class="font-bold text-md">乗車地点</h3>
            <p class="text-gray-600 text-sm">緯度: ${lat.toFixed(4)}, 経度: ${lng.toFixed(4)}</p>
            <button onclick="handleCallRobotClick(${lat}, ${lng})" class="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-2 rounded text-sm mt-2">この場所にロボットを呼ぶ</button>
        </div>`;
    
    const infoWindow = createInfoWindow(popupHtml);
    userMarker.addListener('click', () => openInfoWindow(infoWindow, userMarker));
    openInfoWindow(infoWindow, userMarker);
}

// 目的地マーカーを設置するための新しい関数
function placeDestinationMarker(location, robotDocId) {
    if (userMarker) userMarker.map = null;

    const destPin = new google.maps.marker.PinElement({
        glyph: "🏁", // 旗の絵文字
        background: "#10b981", // Emerald Green
        borderColor: "#FFFFFF",
        scale: 1.2,
    });
    userMarker = createAdvancedMarker(location, destPin.element, "目的地");
    
    const lat = location.lat();
    const lng = location.lng();
    const popupHtml = `
        <div class="p-1 font-sans">
            <h3 class="font-bold text-md">目的地</h3>
            <p class="text-gray-600 text-sm">緯度: ${lat.toFixed(4)}, 経度: ${lng.toFixed(4)}</p>
            <button onclick="handleSetDestinationClick('${robotDocId}', ${lat}, ${lng})" class="bg-emerald-500 hover:bg-emerald-700 text-white font-bold py-1 px-2 rounded text-sm mt-2">この場所へ行く</button>
        </div>`;

    const infoWindow = createInfoWindow(popupHtml);
    userMarker.addListener('click', () => openInfoWindow(infoWindow, userMarker));
    openInfoWindow(infoWindow, userMarker);
}


// --- 汎用ヘルパー関数群 (重複を削減) ---
function createSvgIcon(type) {
    const svgData = {
        person: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`
    };
    const element = document.createElement('div');
    element.innerHTML = svgData[type];
    return element;
}
function createAdvancedMarker(position, content, title) {
    return new google.maps.marker.AdvancedMarkerElement({ position, map, content, title });
}
function createInfoWindow(content) {
    return new google.maps.InfoWindow({ content });
}
function openInfoWindow(infoWindow, anchor) {
    if (activeInfoWindow) activeInfoWindow.close();
    infoWindow.open(map, anchor);
    activeInfoWindow = infoWindow;
}


// --- 既存のコア機能関数群 (一部変更あり) ---
function calculateAndDisplayRoute(robotDocId, origin, destination) {
    if (directionsRenderer) directionsRenderer.setMap(null);
    
    const directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        suppressMarkers: true,
        polylineOptions: { strokeColor: '#0000FF', strokeOpacity: 0.8, strokeWeight: 6 }
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
                const path = response.routes[0].overview_path;
                startMovementSimulation(robotDocId, path);
            } else {
                console.error("Directions request failed: " + status, response);
                window.alert("経路情報の取得に失敗しました: " + status);
            }
        }
    );
}

function startMovementSimulation(robotId, path) {
    if (activeSimulations[robotId]) clearInterval(activeSimulations[robotId]);

    let step = 0;
    const simulationInterval = 1000;
    
    activeSimulations[robotId] = setInterval(async () => {
        if (step >= path.length) {
            clearInterval(activeSimulations[robotId]);
            delete activeSimulations[robotId];
            
            const robotDocRef = doc(db, "robots", robotId);
            const robotDoc = await getDoc(robotDocRef);
            const statusBeforeRide = robotDoc.data().status;
            
            // 配車完了ならアイドリング、目的地到着なら使用中に戻す
            const finalStatus = statusBeforeRide === '配車中' ? 'アイドリング中' : '使用中';

            await updateDoc(robotDocRef, {
                status: finalStatus,
                destination: deleteField()
            });

            if(directionsRenderer) directionsRenderer.setMap(null);
            
            if (finalStatus === 'アイドリング中') {
                 // 配車完了時
                if (userMarker) userMarker.map = null; // ユーザーマーカーを消去
            } else {
                // 目的地到着時
                alert('目的地に到着しました。');
            }
            return;
        }

        const nextPosition = path[step];
        await updateDoc(doc(db, "robots", robotId), {
            position: new GeoPoint(nextPosition.lat(), nextPosition.lng())
        });
        step++;
    }, simulationInterval);
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

    let popupHtml;
    if (robot.status === 'アイドリング中') {
        popupHtml = `<div class="p-1 font-sans"><h3 class="font-bold text-md">${robot.id}</h3><p class="text-gray-700">状態: ${robot.status}</p><button onclick="handleRideButtonClick('${docId}', 'ride')" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded text-sm mt-2">乗車する</button></div>`;
    } else if (robot.status === '使用中') {
        popupHtml = `<div class="p-1 font-sans"><h3 class="font-bold text-md">${robot.id}</h3><p class="text-gray-700">状態: ${robot.status}</p><p class="text-sm text-gray-500 mt-1">地図をクリックして目的地を設定</p><button onclick="handleRideButtonClick('${docId}', 'getoff')" class="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded text-sm mt-2">降車する</button></div>`;
    } else {
        popupHtml = `<div class="p-1 font-sans"><h3 class="font-bold text-md">${robot.id}</h3><p class="text-gray-700">状態: ${robot.status}</p></div>`;
    }

    let markerColor = '#2196F3'; 
    if (robot.status === '走行中') markerColor = '#4CAF50';
    if (robot.status === '使用中') markerColor = '#f59e0b';
    if (robot.status === '配車中') markerColor = '#EAB308';
    
    const pin = new google.maps.marker.PinElement({
        glyph: "🤖",
        background: markerColor,
        borderColor: '#FFFFFF',
        scale: 1.2
    });
    
    const position = { lat: robot.position.latitude, lng: robot.position.longitude };
    const marker = createAdvancedMarker(position, pin.element, robot.id);
    
    const infoWindow = createInfoWindow(popupHtml);
    marker.addListener('click', () => openInfoWindow(infoWindow, marker));
    
    activeMarkers[docId] = marker;
}

// 2点間の距離を計算する関数
function getDistance(pos1, pos2) {
    const R = 6371; // km
    const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
    const dLng = (pos2.lng - pos1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(pos1.lat * Math.PI / 180) * Math.cos(pos2.lat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
