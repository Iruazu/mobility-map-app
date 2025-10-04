import { db, collection, onSnapshot, doc, updateDoc, getDoc, getDocs, GeoPoint, deleteField } from '../config/firebase.js';
import { getDistance } from '../utils/geoUtils.js';

/**
 * ROS2統合版ロボット制御サービス
 * - Web側はFirebaseへの指示とマーカー表示のみ
 * - 実際の移動制御はROS2側が担当
 */
export class RobotService {
    constructor(mapService, uiService, sensorDashboard) { 
        this.mapService = mapService;
        this.uiService = uiService;
        this.sensorDashboard = sensorDashboard;
        
        // ステータス定義（ROS2と完全一致）
        this.STATUS = {
            IDLE: 'idle',
            IN_USE: 'in_use',
            MOVING: 'moving',
            DISPATCHING: 'dispatching'
        };
    }

    /**
     * Firestoreのリアルタイム更新を開始
     */
    startRealtimeUpdates() {
        const robotsCol = collection(db, 'robots');
        
        onSnapshot(robotsCol, (snapshot) => {
            console.log(`📡 Firestore更新検知: ${snapshot.docChanges().length}件`);
            
            snapshot.docChanges().forEach((change) => {
                const docId = change.doc.id;
                const robot = change.doc.data();

                if (change.type === "added" || change.type === "modified") {
                    // マーカー更新
                    this.mapService.updateRobotMarker(docId, robot);
                    
                    // センサーダッシュボード更新
                    if (this.sensorDashboard) {
                        this.sensorDashboard.updateRobotSensors(docId, robot);
                    }
                    
                    // ステータス変化をログ
                    console.log(`🤖 ${robot.id}: ${robot.status}`);
                    
                } else if (change.type === "removed") {
                    this.mapService.removeMarker(docId);
                    if (this.sensorDashboard) {
                        this.sensorDashboard.removeRobotPanel(docId);
                    }
                }
            });
        }, (error) => {
            console.error("❌ リアルタイム更新エラー:", error);
            if (this.uiService) {
                this.uiService.showNotification("データベース接続に問題があります", "error");
            }
        });
    }

    /**
     * ロボットの乗車/降車処理
     * @param {string} docId - ロボットのドキュメントID
     * @param {string} action - 'ride' または 'getoff'
     */
    async handleRideAction(docId, action) {
        try {
            const robotDocRef = doc(db, "robots", docId);
            const newStatus = action === 'ride' ? this.STATUS.IN_USE : this.STATUS.IDLE;
            
            await updateDoc(robotDocRef, { 
                status: newStatus,
                last_updated: new Date().toISOString()
            });
            
            if (action === 'ride') {
                this.mapService.removeUserMarker();
                this.uiService?.showNotification(`ロボット ${docId} に乗車しました`, "success");
            } else {
                this.mapService.clearRoute();
                this.uiService?.showNotification(`ロボット ${docId} から降車しました`, "success");
            }
            
            // InfoWindowを閉じる
            if (this.mapService.activeInfoWindow) {
                this.mapService.activeInfoWindow.close();
            }
            
        } catch (error) {
            console.error("❌ 乗車/降車処理エラー:", error);
            this.uiService?.showNotification("操作に失敗しました", "error");
        }
    }

    /**
     * ロボット配車処理（ROS2に目的地を指示）
     * @param {number} lat - 緯度
     * @param {number} lng - 経度
     */
    async callRobot(lat, lng) {
        try {
            console.log(`🚕 配車リクエスト: (${lat.toFixed(6)}, ${lng.toFixed(6)})`);
            
            // アイドル状態のロボットを検索
            const robotsCol = collection(db, 'robots');
            const robotSnapshot = await getDocs(robotsCol);
            
            let closestRobot = null;
            let minDistance = Infinity;

            robotSnapshot.forEach((robotDoc) => {
                const robot = robotDoc.data();
                
                // ステータスチェック（厳密な一致）
                if (robot.status === this.STATUS.IDLE) {
                    const robotPos = robot.position;
                    
                    if (!robotPos?.latitude || !robotPos?.longitude) {
                        console.warn(`⚠️ ロボット ${robot.id} の位置情報が不正`);
                        return;
                    }
                    
                    const distance = getDistance(
                        { lat, lng },
                        { lat: robotPos.latitude, lng: robotPos.longitude }
                    );
                    
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestRobot = { 
                            docId: robotDoc.id, 
                            data: robot,
                            distance: distance 
                        };
                    }
                }
            });

            if (!closestRobot) {
                this.uiService?.showNotification("現在、利用可能なロボットがいません", "warning");
                return;
            }
            
            console.log(`✅ 最寄りロボット: ${closestRobot.data.id} (${closestRobot.distance.toFixed(2)}km)`);
            
            // Firebaseに目的地を書き込み（ROS2が読み取る）
            const robotDocRef = doc(db, "robots", closestRobot.docId);
            await updateDoc(robotDocRef, {
                status: this.STATUS.DISPATCHING,
                destination: new GeoPoint(lat, lng),
                last_updated: new Date().toISOString()
            });

            this.uiService?.showNotification(
                `ロボット ${closestRobot.data.id} を配車しました`, 
                "success"
            );
            
            // 経路表示（視覚的フィードバックのみ）
            this.mapService.displayRoute(
                closestRobot.data.position, 
                { lat, lng },
                () => {
                    console.log('📍 経路表示完了');
                }
            );
            
        } catch (error) {
            console.error("❌ 配車処理エラー:", error);
            this.uiService?.showNotification("配車リクエストに失敗しました", "error");
        }
    }

    /**
     * 目的地設定処理（ROS2に移動指示）
     * @param {string} robotDocId - ロボットのドキュメントID
     * @param {number} lat - 緯度
     * @param {number} lng - 経度
     */
    async setDestination(robotDocId, lat, lng) {
        try {
            console.log(`🎯 目的地設定: ${robotDocId} → (${lat.toFixed(6)}, ${lng.toFixed(6)})`);
            
            const robotDocRef = doc(db, "robots", robotDocId);
            const robotDoc = await getDoc(robotDocRef);
            
            if (!robotDoc.exists()) {
                this.uiService?.showNotification("ロボットが見つかりません", "error");
                return;
            }

            const robotData = robotDoc.data();
            
            // ステータスチェック
            if (robotData.status !== this.STATUS.IN_USE) {
                this.uiService?.showNotification("このロボットは使用できません", "warning");
                return;
            }

            const currentPosition = robotData.position;
            const destination = { lat, lng };

            // Firebaseに目的地を書き込み（ROS2が実際に移動）
            await updateDoc(robotDocRef, {
                status: this.STATUS.MOVING,
                destination: new GeoPoint(destination.lat, destination.lng),
                last_updated: new Date().toISOString()
            });

            this.uiService?.showNotification(
                `目的地を設定しました。ロボットが移動を開始します`, 
                "success"
            );
            
            // 経路表示（視覚的フィードバック）
            this.mapService.displayRoute(currentPosition, destination, () => {
                console.log('📍 経路表示完了');
            });
            
        } catch (error) {
            console.error("❌ 目的地設定エラー:", error);
            this.uiService?.showNotification("目的地の設定に失敗しました", "error");
        }
    }

    /**
     * 使用中のロボットを取得
     * @returns {Promise<Object|null>}
     */
    async getInUseRobot() {
        try {
            const robotsCol = collection(db, 'robots');
            const robotSnapshot = await getDocs(robotsCol);
            
            const inUseRobotDoc = robotSnapshot.docs.find(
                robotDoc => robotDoc.data().status === this.STATUS.IN_USE
            );
            
            if (inUseRobotDoc) {
                return { 
                    id: inUseRobotDoc.id, 
                    data: inUseRobotDoc.data() 
                };
            }
            
            return null;
            
        } catch (error) {
            console.error("❌ 使用中ロボット取得エラー:", error);
            return null;
        }
    }

    /**
     * ロボットの詳細情報を取得
     * @param {string} robotId - ロボットID
     * @returns {Promise<Object|null>}
     */
    async getRobotDetails(robotId) {
        try {
            const robotDocRef = doc(db, "robots", robotId);
            const robotDoc = await getDoc(robotDocRef);
            
            if (robotDoc.exists()) {
                return { id: robotDoc.id, data: robotDoc.data() };
            }
            
            return null;
            
        } catch (error) {
            console.error(`❌ ロボット ${robotId} 詳細取得エラー:`, error);
            return null;
        }
    }

    /**
     * 緊急停止処理
     * @param {string} robotId - ロボットID
     */
    async emergencyStop(robotId) {
        try {
            console.warn(`🛑 緊急停止: ${robotId}`);
            
            const robotDocRef = doc(db, "robots", robotId);
            await updateDoc(robotDocRef, {
                status: this.STATUS.IDLE,
                destination: deleteField(),
                last_updated: new Date().toISOString()
            });
            
            this.mapService.clearRoute();
            this.uiService?.showNotification(`ロボット ${robotId} を停止しました`, "warning");
            
        } catch (error) {
            console.error("❌ 緊急停止エラー:", error);
            this.uiService?.showNotification("停止処理に失敗しました", "error");
        }
    }

    /**
     * クリーンアップ（Web側のシミュレーション関連は不要）
     */
    cleanup() {
        console.log("🧹 RobotService クリーンアップ完了");
        // ROS2統合版では特に処理なし
    }
}