import { db, collection, onSnapshot, doc, updateDoc, getDoc, getDocs, GeoPoint, deleteField } from '../config/firebase.js';
import { getDistance } from '../utils/geoUtils.js';

/**
 * ロボット制御サービス
 */
export class RobotService {
    // 1. 🚀 コンストラクターに UIService と SensorDashboard を追加
    constructor(mapService, uiService, sensorDashboard) { 
        this.mapService = mapService;
        this.uiService = uiService; // UIServiceは通知などに利用可能
        this.sensorDashboard = sensorDashboard; // ダッシュボード連携用
        this.activeSimulations = {};
    }

    /**
     * Firestoreのリアルタイム更新を開始する
     */
    startRealtimeUpdates() {
        const robotsCol = collection(db, 'robots');
        onSnapshot(robotsCol, (snapshot) => {
            console.log("データベースが更新されました！");
            snapshot.docChanges().forEach((change) => {
                const docId = change.doc.id;
                const robot = change.doc.data();

                // 2. 🚀 onSnapshot の処理を強化し、ダッシュボード連携と Webシミュレーションの削除を反映
                if (change.type === "added" || change.type === "modified") {
                    // 地図マーカーとステータスの更新
                    this.mapService.updateRobotMarker(docId, robot);
                    
                    // センサーダッシュボードを更新
                    this.sensorDashboard.updateRobotSensors(docId, robot); // <-- NEW

                    // 🚨 IMPORTANT: 以下の行は、WebシミュレーションをROS2/Firebaseに置き換えるため削除
                    // this.mapService.createRobotMarker(docId, robot);
                } else if (change.type === "removed") {
                    this.mapService.removeMarker(docId);
                    this.sensorDashboard.removeRobotPanel(docId); // <-- NEW
                }
            });
        }, (error) => {
            console.error("リアルタイム更新エラー:", error);
            // エラー通知をUIService経由で行う
            this.uiService.showNotification("データベース接続に問題があります。", "error");
        });
    }

    /**
     * ロボットの乗車/降車処理
     * @param {string} docId - ロボットのドキュメントID
     * @param {string} action - アクション ('ride' または 'getoff')
     */
    async handleRideAction(docId, action) {
        try {
            const robotDocRef = doc(db, "robots", docId);
            const statusUpdate = action === 'ride' ? 'in_use' : 'idle'; // 🚀 ステータス文字列をROS2側と連携しやすい英語に変更
            
            await updateDoc(robotDocRef, { status: statusUpdate });
            
            if (action === 'ride') {
                this.mapService.removeUserMarker();
                this.uiService.showNotification(`ロボット ${docId} に乗車しました`, "success");
            } else {
                this.uiService.showNotification(`ロボット ${docId} から降車しました`, "success");
            }
            
            if (this.mapService.activeInfoWindow) {
                this.mapService.activeInfoWindow.close();
            }
        } catch (error) {
            console.error("乗車/降車処理エラー:", error);
            this.uiService.showNotification("操作に失敗しました。", "error");
        }
    }

    /**
     * ロボット配車処理 (目的地をFirebaseに書き込む)
     * @param {number} lat - 緯度
     * @param {number} lng - 経度
     */
    async callRobot(lat, lng) {
        try {
            console.log(`配車リクエスト発生！ 場所: (${lat}, ${lng})`);
            
            const robotsCol = collection(db, 'robots');
            const robotSnapshot = await getDocs(robotsCol);
            let closestRobot = null;
            let minDistance = Infinity;

            // 🚨 注意: ロボットのステータスチェックを英語の'idle'に合わせる
            robotSnapshot.forEach((doc) => {
                const robot = doc.data();
                if (robot.status === 'idle') { 
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
                this.uiService.showNotification("現在、利用可能なロボットがいません。", "warning");
                return;
            }
            
            this.uiService.showNotification(`最も近いロボット ${closestRobot.data.id} が配車されます`, "info");
            
            const robotDocRef = doc(db, "robots", closestRobot.docId);
            // 🚨 ここで目的地を書き込み、ROS2 Bridgeがこれをコマンドとして受け取ります
            await updateDoc(robotDocRef, {
                status: 'dispatching', // 🚀 英語ステータス
                destination: new GeoPoint(lat, lng)
            });

            // 🚨 Web側のシミュレーション開始ロジックは削除
            // this.calculateAndStartRoute(closestRobot.docId, closestRobot.data.position, { lat, lng }); 
        } catch (error) {
            console.error("配車処理エラー:", error);
            this.uiService.showNotification("配車リクエストに失敗しました。", "error");
        }
    }

    /**
     * 目的地設定処理 (Firebaseに書き込む)
     * @param {string} robotDocId - ロボットのドキュメントID
     * @param {number} lat - 緯度
     * @param {number} lng - 経度
     */
    async setDestination(robotDocId, lat, lng) {
        try {
            console.log(`目的地設定！ ロボットID: ${robotDocId}, 場所: (${lat}, ${lng})`);
            
            const robotDocRef = doc(db, "robots", robotDocId);
            const robotDoc = await getDoc(robotDocRef);
            if (!robotDoc.exists()) {
                this.uiService.showNotification("ロボットが見つかりません。", "error");
                return;
            }

            const currentPosition = robotDoc.data().position;
            const destination = { lat, lng };

            // 🚨 ここで目的地を書き込み、ROS2 Bridgeがこれをコマンドとして受け取ります
            await updateDoc(robotDocRef, {
                status: 'moving', // 🚀 英語ステータス
                destination: new GeoPoint(destination.lat, destination.lng)
            });

            // 🚨 経路表示のみWeb側で行う（シミュレーションはROS2側が実施）
            this.mapService.displayRoute(currentPosition, destination, () => {
                // ROS2側が移動を開始し、Firebaseを更新するため、ここではシミュレーションは行わない
                this.uiService.showNotification(`ロボット ${robotDocId} の移動を開始します`, "info");
            });
            
            // 🚨 Web側のシミュレーション開始ロジックは削除
            // this.calculateAndStartRoute(robotDocId, currentPosition, destination);
        } catch (error) {
            console.error("目的地設定エラー:", error);
            this.uiService.showNotification("目的地の設定に失敗しました。", "error");
        }
    }

    // 🚨 以下の Web シミュレーション関連メソッドは、ROS2制御に移行するためすべて削除または無効化します。
    // 代わりに、ROS2側が Firebase を更新し、onSnapshot コールバック (startRealtimeUpdates内) がマップを自動更新します。
    // calculateAndStartRoute(robotDocId, origin, destination) { ... }
    // startMovementSimulation(robotId, path) { ... }
    // handleMovementComplete(robotId) { ... }
    // stopMovementSimulation(robotId) { ... }
    
    // 🚨 既存のメソッドを簡素化し、ROS2移行後のクリーンアップに対応
    stopAllSimulations() {
        // ROS2制御後は、タイマーベースのシミュレーションはないため、空またはログのみ
        console.log("Web側のシミュレーションは無効化されています。");
        // Object.keys(this.activeSimulations).forEach(robotId => { this.stopMovementSimulation(robotId); });
    }
    
    // ... (getInUseRobot など、他のメソッドは変更なし)
}