import { db, collection, onSnapshot, doc, updateDoc, getDoc, getDocs, GeoPoint, deleteField } from '../config/firebase.js';
import { getDistance } from '../utils/geoUtils.js';

/**
 * ROS2統合版ロボット制御サービス（更新最適化版）
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
        
        // 🚨 更新頻度制御用のキャッシュ
        this.lastUpdateCache = {};
        this.updateThrottle = 500; // 500ms以内の更新は無視
    }

    /**
     * Firestoreのリアルタイム更新を開始（最適化版）
     */
    startRealtimeUpdates() {
        const robotsCol = collection(db, 'robots');
        
        onSnapshot(robotsCol, (snapshot) => {
            const now = Date.now();
            let significantChanges = 0;
            
            snapshot.docChanges().forEach((change) => {
                const docId = change.doc.id;
                const robot = change.doc.data();

                if (change.type === "added" || change.type === "modified") {
                    // 🚨 重要な変更のみ処理
                    if (this.shouldProcessUpdate(docId, robot, now)) {
                        // マーカー更新
                        this.mapService.updateRobotMarker(docId, robot);
                        
                        // センサーダッシュボード更新
                        if (this.sensorDashboard) {
                            this.sensorDashboard.updateRobotSensors(docId, robot);
                        }
                        
                        significantChanges++;
                        
                        // キャッシュ更新
                        this.lastUpdateCache[docId] = {
                            timestamp: now,
                            status: robot.status,
                            position: robot.position,
                            destination: robot.destination
                        };
                    }
                    
                } else if (change.type === "removed") {
                    this.mapService.removeMarker(docId);
                    if (this.sensorDashboard) {
                        this.sensorDashboard.removeRobotPanel(docId);
                    }
                    delete this.lastUpdateCache[docId];
                }
            });
            
            // 重要な変更があった場合のみログ出力
            if (significantChanges > 0) {
                console.log(`📡 Firestore更新処理: ${significantChanges}件の重要な変更`);
            }
        }, (error) => {
            console.error("❌ リアルタイム更新エラー:", error);
            if (this.uiService) {
                this.uiService.showNotification("データベース接続に問題があります", "error");
            }
        });
    }

    /**
     * 🚨 更新を処理すべきか判断（重複・無意味な更新をスキップ）
     * @param {string} docId - ロボットのドキュメントID
     * @param {Object} robot - 新しいロボットデータ
     * @param {number} now - 現在時刻（ミリ秒）
     * @returns {boolean} 処理すべきならtrue
     */
    shouldProcessUpdate(docId, robot, now) {
        const lastUpdate = this.lastUpdateCache[docId];
        
        // 初回は必ず処理
        if (!lastUpdate) {
            return true;
        }
        
        // スロットリング: 500ms以内の更新は無視
        if (now - lastUpdate.timestamp < this.updateThrottle) {
            return false;
        }
        
        // ステータス変更は必ず処理
        if (robot.status !== lastUpdate.status) {
            console.log(`🤖 ${robot.id}: ${lastUpdate.status} → ${robot.status}`);
            return true;
        }
        
        // destination の変更は必ず処理
        const destChanged = this.hasDestinationChanged(lastUpdate.destination, robot.destination);
        if (destChanged) {
            console.log(`🎯 ${robot.id}: destination 変更検知`);
            return true;
        }
        
        // 位置の大きな変化は処理（移動中のみ）
        if (robot.status === this.STATUS.MOVING || robot.status === this.STATUS.DISPATCHING) {
            const posChanged = this.hasPositionChanged(lastUpdate.position, robot.position);
            if (posChanged) {
                return true;
            }
        }
        
        // その他の場合はスキップ
        return false;
    }

    /**
     * destination が変更されたかチェック
     */
    hasDestinationChanged(oldDest, newDest) {
        // 両方nullなら変更なし
        if (!oldDest && !newDest) return false;
        
        // 片方だけnullなら変更あり
        if (!oldDest || !newDest) return true;
        
        // 座標の差分チェック（0.00001度 ≈ 1m）
        const tolerance = 0.00001;
        const latDiff = Math.abs(newDest.latitude - oldDest.latitude);
        const lngDiff = Math.abs(newDest.longitude - oldDest.longitude);
        
        return latDiff > tolerance || lngDiff > tolerance;
    }

    /**
     * position が大きく変更されたかチェック
     */
    hasPositionChanged(oldPos, newPos) {
        if (!oldPos || !newPos) return true;
        
        // 5m以上の移動で更新
        const tolerance = 0.00005; // 約5m
        const latDiff = Math.abs(newPos.latitude - oldPos.latitude);
        const lngDiff = Math.abs(newPos.longitude - oldPos.longitude);
        
        return latDiff > tolerance || lngDiff > tolerance;
    }

    /**
     * ロボットの乗車/降車処理
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
                this.uiService?.showNotification(`ロボットに乗車しました`, "success");
            } else {
                this.mapService.clearRoute();
                this.uiService?.showNotification(`ロボットから降車しました`, "success");
            }
            
            if (this.mapService.activeInfoWindow) {
                this.mapService.activeInfoWindow.close();
            }
            
        } catch (error) {
            console.error("❌ 乗車/降車処理エラー:", error);
            this.uiService?.showNotification("操作に失敗しました", "error");
        }
    }

    /**
     * ロボット配車処理
     */
    async callRobot(lat, lng) {
        try {
            console.log(`🚕 配車リクエスト: (${lat.toFixed(6)}, ${lng.toFixed(6)})`);
            
            const robotsCol = collection(db, 'robots');
            const robotSnapshot = await getDocs(robotsCol);
            
            let closestRobot = null;
            let minDistance = Infinity;

            robotSnapshot.forEach((robotDoc) => {
                const robot = robotDoc.data();
                
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
            
            this.mapService.displayRoute(
                closestRobot.data.position, 
                { lat, lng },
                () => console.log('📍 経路表示完了')
            );
            
        } catch (error) {
            console.error("❌ 配車処理エラー:", error);
            this.uiService?.showNotification("配車リクエストに失敗しました", "error");
        }
    }

    /**
     * 目的地設定処理
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
            
            if (robotData.status !== this.STATUS.IN_USE) {
                this.uiService?.showNotification("このロボットは使用できません", "warning");
                return;
            }

            const currentPosition = robotData.position;
            const destination = { lat, lng };

            await updateDoc(robotDocRef, {
                status: this.STATUS.MOVING,
                destination: new GeoPoint(destination.lat, destination.lng),
                last_updated: new Date().toISOString()
            });

            this.uiService?.showNotification(
                `目的地を設定しました。ロボットが移動を開始します`, 
                "success"
            );
            
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
     * 緊急停止処理
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
     * クリーンアップ
     */
    cleanup() {
        console.log("🧹 RobotService クリーンアップ完了");
        this.lastUpdateCache = {};
    }
}