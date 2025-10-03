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

                if (change.type === "added" || change.type === "modified") {
                    // 地図マーカーとステータスの更新
                    // 🚨 updateRobotMarker は MapService に存在することを確認済み
                    this.mapService.updateRobotMarker(docId, robot);
                    
                    // センサーダッシュボードを更新
                    this.sensorDashboard.updateRobotSensors(docId, robot);

                } else if (change.type === "removed") {
                    this.mapService.removeMarker(docId);
                    this.sensorDashboard.removeRobotPanel(docId);
                }
            });
        }, (error) => {
            console.error("リアルタイム更新エラー:", error);
            this.uiService.showNotification("データベース接続に問題があります。", "error");
        });
    }

    /**
     * ロボットの乗車/降車処理
     */
    async handleRideAction(docId, action) {
        try {
            const robotDocRef = doc(db, "robots", docId);
            const statusUpdate = action === 'ride' ? 'in_use' : 'idle'; 
            
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
     */
    async callRobot(lat, lng) {
        try {
            console.log(`配車リクエスト発生！ 場所: (${lat}, ${lng})`);
            
            const robotsCol = collection(db, 'robots');
            const robotSnapshot = await getDocs(robotsCol);
            let closestRobot = null;
            let minDistance = Infinity;

            robotSnapshot.forEach((doc) => {
                const robot = doc.data();
                if (robot.status === 'idle') { 
                    // 🚨 GeoPointから緯度経度を取得するロジックは既に修正済みと仮定
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
            await updateDoc(robotDocRef, {
                status: 'dispatching', // 英語ステータス
                destination: new GeoPoint(lat, lng)
            });

        } catch (error) {
            console.error("配車処理エラー:", error);
            this.uiService.showNotification("配車リクエストに失敗しました。", "error");
        }
    }

    /**
     * 目的地設定処理 (Firebaseに書き込む)
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

            await updateDoc(robotDocRef, {
                status: 'moving', // 英語ステータス
                destination: new GeoPoint(destination.lat, destination.lng)
            });

            // 経路表示のみWeb側で行う（シミュレーションはROS2側が実施）
            this.mapService.displayRoute(currentPosition, destination, () => {
                this.uiService.showNotification(`ロボット ${robotDocId} の移動を開始します`, "info");
            });
            
        } catch (error) {
            console.error("目的地設定エラー:", error);
            this.uiService.showNotification("目的地の設定に失敗しました。", "error");
        }
    }

    /**
     * 使用中のロボットを取得 (uiServiceからの呼び出しに対応)
     * @returns {Promise<Object|null>} 使用中のロボットまたはnull
     */
    async getInUseRobot() {
        try {
            const robotsCol = collection(db, 'robots');
            const robotSnapshot = await getDocs(robotsCol);
            
            // 🚨 ステータスは Web と ROS2 で統一した 'in_use' を使用
            const inUseRobotDoc = robotSnapshot.docs.find(doc => doc.data().status === 'in_use'); 
            
            return inUseRobotDoc ? { id: inUseRobotDoc.id, data: inUseRobotDoc.data() } : null;
        } catch (error) {
            console.error("使用中ロボット取得エラー:", error);
            return null;
        }
    }

    /**
     * 既存のメソッドを簡素化し、ROS2移行後のクリーンアップに対応
     */
    stopAllSimulations() {
        // ROS2制御後は、タイマーベースのシミュレーションはないため、空またはログのみ
        console.log("Web側のシミュレーションは無効化されています。");
    }
}