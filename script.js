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

// --- サイドバー関連の変数 ---
let sidebarOpen = false;
let robotData = {}; // ロボットデータを保持

// --- グローバル関数定義 ---

// ロボットの「乗車/降車」ボタンがクリックされたときの処理
window.handleRideButtonClick = async (docId, action) => {
    const robotDocRef = doc(db, "robots", docId);
    if (action === 'ride') {
        await updateDoc(robotDocRef, { status: '使用中' });
        if (userMarker) userMarker.map = null; // 乗車したらユーザーマーカーを消す
        showNotification('乗車しました！目的地を設定してください。', 'success');
    } else { // getoff
        await updateDoc(robotDocRef, { status: 'アイドリング中' });
        showNotification('降車しました。', 'success');
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
        showNotification("現在、利用可能なロボットがいません。", 'warning');
        return;
    }
    
    console.log(`最も近いロボットが見つかりました: ${closestRobot.data.id}`);
    showNotification(`${closestRobot.data.id}を配車しています...`, 'info');
    
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

    showNotification('目的地を設定しました。出発します！', 'success');

    // 現在地から最終目的地までの経路を計算・表示
    calculateAndDisplayRoute(robotDocId, currentPosition, destination);
};

// サイドバーのロボット項目がクリックされたときの処理
window.handleRobotItemClick = (docId) => {
    const robot = robotData[docId];
    if (!robot || !robot.position) return;
    
    const position = { lat: robot.position.latitude, lng: robot.position.longitude };
    map.setCenter(position);
    map.setZoom(18);
    
    // マーカーをクリックしてInfoWindowを開く
    if (activeMarkers[docId]) {
        google.maps.event.trigger(activeMarkers[docId], 'click');
    }
    
    // サイドバーを閉じる
    closeSidebar();
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

    // サイドバーの初期化
    initializeSidebar();

    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("匿名認証に成功しました。UserID:", user.uid);
            startRealtimeUpdates();
        } else {
            signInAnonymously(auth).catch((error) => console.error("匿名サインインエラー:", error));
        }
    });
};

// サイドバーの初期化
function initializeSidebar() {
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const closeSidebarBtn = document.getElementById('close-sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    hamburgerBtn.addEventListener('click', toggleSidebar);
    closeSidebarBtn.addEventListener('click', closeSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);
}

// サイドバーの開閉
function toggleSidebar() {
    if (sidebarOpen) {
        closeSidebar();
    } else {
        openSidebar();
    }
}

function openSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const hamburgerIcon = document.querySelector('.hamburger-icon');
    
    sidebar.classList.add('open');
    overlay.classList.add('active');
    hamburgerIcon.classList.add('active');
    sidebarOpen = true;
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const hamburgerIcon = document.querySelector('.hamburger-icon');
    
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    hamburgerIcon.classList.remove('active');
    sidebarOpen = false;
}

// ロボット一覧の更新
function updateRobotList() {
    const robotListContainer = document.getElementById('robot-list');
    
    if (Object.keys(robotData).length === 0) {
        robotListContainer.innerHTML = `
            <div class="text-center text-gray-500 py-4">
                <p>ロボットが見つかりません</p>
            </div>
        `;
        return;
    }
    
    const robotItems = Object.entries(robotData).map(([docId, robot]) => {
        const statusClass = getStatusClass(robot.status);
        const statusText = robot.status;
        const locationText = robot.position ? 
            `${robot.position.latitude.toFixed(4)}, ${robot.position.longitude.toFixed(4)}` : 
            '位置情報なし';
        
        return `
            <div class="robot-item ${statusClass}" onclick="handleRobotItemClick('${docId}')">
                <div class="robot-name">${robot.id}</div>
                <div class="robot-status">状態: ${statusText}</div>
                <div class="robot-location">📍 ${locationText}</div>
            </div>
        `;
    }).join('');
    
    robotListContainer.innerHTML = robotItems;
}

// ステータスに応じたCSSクラスを返す
function getStatusClass(status) {
    switch (status) {
        case 'アイドリング中': return 'status-idle';
        case '使用中': return 'status-in-use';
        case '配車中': return 'status-dispatching';
        case '走行中': return 'status-moving';
        default: return '';
    }
}

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
        <div class="p-3 font-sans">
            <h3 class="font-bold text-lg mb-2">乗車地点</h3>
            <p class="text-gray-600 text-sm mb-3">緯度: ${lat.toFixed(4)}, 経度: ${lng.toFixed(4)}</p>
            <button onclick="handleCallRobotClick(${lat}, ${lng})" class="action-button primary">
                🚗 この場所にロボットを呼ぶ
            </button>
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
        <div class="p-3 font-sans">
            <h3 class="font-bold text-lg mb-2">目的地</h3>
            <p class="text-gray-600 text-sm mb-3">緯度: ${lat.toFixed(4)}, 経度: ${lng.toFixed(4)}</p>
            <button onclick="handleSetDestinationClick('${robotDocId}', ${lat}, ${lng})" class="action-button primary">
                🏁 この場所へ行く
            </button>
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
                showNotification("経路情報の取得に失敗しました: " + status, 'error');
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
            
            if (statusBeforeRide === '配車中') {
                // 配車完了時
                await updateDoc(robotDocRef, {
                    status: 'アイドリング中',
                    destination: deleteField()
                });
                if (userMarker) userMarker.map = null;
                showNotification('ロボットが到着しました！', 'success');
            } else {
                // 目的地到着時 - 自動降車処理
                await updateDoc(robotDocRef, {
                    status: 'アイドリング中', // 自動で降車状態に
                    destination: deleteField()
                });
                if (userMarker) userMarker.map = null;
                showNotification('目的地に到着しました。自動的に降車しました。', 'success');
            }

            if(directionsRenderer) directionsRenderer.setMap(null);
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
                robotData[docId] = robot; // サイドバー用のデータを更新
                if (activeMarkers[docId]) activeMarkers[docId].map = null;
                createMarker(docId, robot);
            } else if (change.type === "removed") {
                delete robotData[docId]; // サイドバー用のデータを削除
                if (activeMarkers[docId]) {
                    activeMarkers[docId].map = null;
                    delete activeMarkers[docId];
                }
            }
        });
        
        // サイドバーのロボット一覧を更新
        updateRobotList();
    });
}

// マーカーを作成する関数
function createMarker(docId, robot) {
    if (!robot.position?.latitude || !robot.position?.longitude) return;

    let popupHtml;
    if (robot.status === 'アイドリング中') {
        popupHtml = `
            <div class="p-3 font-sans">
                <h3 class="font-bold text-lg mb-2">${robot.id}</h3>
                <div class="status-badge status-idle">利用可能</div>
                <button onclick="handleRideButtonClick('${docId}', 'ride')" class="action-button primary mt-3">
                    🚗 乗車する
                </button>
            </div>`;
    } else if (robot.status === '使用中') {
        popupHtml = `
            <div class="p-3 font-sans">
                <h3 class="font-bold text-lg mb-2">${robot.id}</h3>
                <div class="status-badge status-in-use">使用中</div>
                <p class="text-sm text-gray-600 mt-2 mb-3">📍 地図をクリックして目的地を設定してください</p>
                <button onclick="handleRideButtonClick('${docId}', 'getoff')" class="action-button secondary">
                    🚪 降車する
                </button>
            </div>`;
    } else if (robot.status === '配車中') {
        popupHtml = `
            <div class="p-3 font-sans">
                <h3 class="font-bold text-lg mb-2">${robot.id}</h3>
                <div class="status-badge status-dispatching">配車中</div>
                <p class="text-sm text-gray-600 mt-2">お迎えに向かっています...</p>
            </div>`;
    } else if (robot.status === '走行中') {
        popupHtml = `
            <div class="p-3 font-sans">
                <h3 class="font-bold text-lg mb-2">${robot.id}</h3>
                <div class="status-badge status-moving">走行中</div>
                <p class="text-sm text-gray-600 mt-2">目的地に向かっています...</p>
            </div>`;
    } else {
        popupHtml = `
            <div class="p-3 font-sans">
                <h3 class="font-bold text-lg mb-2">${robot.id}</h3>
                <div class="status-badge">${robot.status}</div>
            </div>`;
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

// 通知を表示する関数
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${getNotificationIcon(type)}</span>
            <span class="notification-message">${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // アニメーション開始
    setTimeout(() => notification.classList.add('show'), 100);
    
    // 3秒後に自動で消去
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

function getNotificationIcon(type) {
    switch(type) {
        case 'success': return '✅';
        case 'warning': return '⚠️';
        case 'error': return '❌';
        default: return 'ℹ️';
    }
}