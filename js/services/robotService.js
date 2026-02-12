import { db, rtdb, ref, set, collection, onSnapshot, doc, updateDoc, getDoc, getDocs, GeoPoint, deleteField } from '../config/firebase.js';
import { getDistance } from '../utils/geoUtils.js';

/**
 * Phase 2完全版 + UIステータスバー連携
 * 配車機能修正版
 */
export class RobotService {
    constructor(mapService, uiService, sensorDashboard) {
        this.mapService = mapService;
        this.uiService = uiService;
        this.sensorDashboard = sensorDashboard;

        this.STATUS = {
            IDLE: 'idle',
            IN_USE: 'in_use',
            MOVING: 'moving',
            DISPATCHING: 'dispatching'
        };

        this.lastUpdateCache = {};
        this.updateThrottle = 100;

        this.lastProcessedDestinations = {};
        this.destinationProcessingLock = {};

        console.log("🚀 Phase 2 RobotService + UI連携 initialized");
    }

    calculateDestinationHash(destination) {
        if (!destination || !destination.latitude || !destination.longitude) {
            return null;
        }
        const latRounded = Math.round(destination.latitude * 100000) / 100000;
        const lngRounded = Math.round(destination.longitude * 100000) / 100000;
        return `${latRounded.toFixed(5)}_${lngRounded.toFixed(5)}`;
    }

    /**
     * Firestoreのリアルタイム更新を開始（UI連携版）
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
                    // ステータス変更を先に検知（UIステータスバー用）
                    const oldStatus = this.lastUpdateCache[docId]?.status;

                    if (this.shouldProcessUpdate(docId, robot, now)) {
                        // マーカー更新
                        this.mapService.updateRobotMarker(docId, robot);

                        // センサーダッシュボード更新
                        if (this.sensorDashboard) {
                            this.sensorDashboard.updateRobotSensors(docId, robot);
                        }

                        // UIサービス: ロボットリスト更新
                        if (this.uiService) {
                            this.uiService.updateRobotList(docId, robot);
                        }

                        // UIサービス: ステータスバー更新
                        if (this.uiService && robot.status !== oldStatus && oldStatus !== undefined) {
                            this.uiService.onRobotStatusChange(docId, robot.status, oldStatus);
                        }

                        significantChanges++;

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
                    if (this.uiService) {
                        this.uiService.removeRobotFromList(docId);
                    }
                    delete this.lastUpdateCache[docId];
                }
            });

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

    shouldProcessUpdate(docId, robot, now) {
        const lastUpdate = this.lastUpdateCache[docId];

        if (!lastUpdate) {
            console.log(`🆕 ${robot.id}: 初回マーカー作成`);
            return true;
        }

        if (now - lastUpdate.timestamp < this.updateThrottle) {
            return false;
        }

        if (robot.status !== lastUpdate.status) {
            console.log(`🤖 ${robot.id}: ステータス変更 ${lastUpdate.status} → ${robot.status}`);
            return true;
        }

        const destChanged = this.hasDestinationChangedRobust(docId, lastUpdate.destination, robot.destination);
        if (destChanged) {
            console.log(`🎯 ${robot.id}: destination変更検知 [Web側]`);
            return true;
        }

        const posChanged = this.hasPositionChanged(lastUpdate.position, robot.position);
        if (posChanged) {
            const oldPos = lastUpdate.position;
            const newPos = robot.position;
            console.log(
                `📍 ${robot.id}: 位置更新 ` +
                `(${oldPos?.latitude.toFixed(6)}, ${oldPos?.longitude.toFixed(6)}) → ` +
                `(${newPos?.latitude.toFixed(6)}, ${newPos?.longitude.toFixed(6)})`
            );
            return true;
        }

        return false;
    }

    hasDestinationChangedRobust(robotId, oldDest, newDest) {
        if (!oldDest && !newDest) return false;
        if (!oldDest || !newDest) return true;
        const oldHash = this.calculateDestinationHash(oldDest);
        const newHash = this.calculateDestinationHash(newDest);
        return oldHash !== newHash;
    }

    hasPositionChanged(oldPos, newPos) {
        if (!oldPos || !newPos) return true;
        const tolerance = 0.00001;
        const latDiff = Math.abs(newPos.latitude - oldPos.latitude);
        const lngDiff = Math.abs(newPos.longitude - oldPos.longitude);
        return latDiff > tolerance || lngDiff > tolerance;
    }

    /**
     * 乗車/降車処理
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
                console.warn("⚠️ 利用可能なロボットが見つかりません");
                this.uiService?.showNotification("現在、利用可能なロボットがいません", "warning");
                return;
            }

            console.log(`✅ 最寄りロボット: ${closestRobot.data.id} (${closestRobot.distance.toFixed(2)}km)`);

            const destHash = this.calculateDestinationHash({ latitude: lat, longitude: lng });
            const robotId = closestRobot.docId;

            if (this.lastProcessedDestinations[robotId] === destHash) {
                console.warn(`⏸️ 同じdestinationが既に処理中: ${destHash}`);
                this.uiService?.showNotification("このロボットは既に配車処理中です", "info");
                return;
            }

            if (this.destinationProcessingLock[robotId]) {
                console.warn(`🔒 ロボット ${robotId} は処理中です`);
                return;
            }

            this.destinationProcessingLock[robotId] = true;
            this.lastProcessedDestinations[robotId] = destHash;

            const goalRef = ref(rtdb, 'robot/goal');
            await set(goalRef, {
                x: lat,
                y: lng
            });

            console.log(`📍 Realtime Database に目標座標を設定: (${lat}, ${lng})`);

            const robotDocRef = doc(db, "robots", robotId);
            await updateDoc(robotDocRef, {
                status: this.STATUS.DISPATCHING,
                destination: new GeoPoint(lat, lng),
                last_updated: new Date().toISOString()
            });

            this.uiService?.showNotification(
                `ロボット ${closestRobot.data.id} を配車しました`,
                "success"
            );

            // UIステータスバー表示
            this.uiService?.showStatusBar('dispatching');

            setTimeout(() => {
                this.destinationProcessingLock[robotId] = false;
            }, 2000);

            console.log(`📍 destination設定完了 [Hash: ${destHash}]`);

        } catch (error) {
            console.error("❌ 配車処理エラー:", error);
            this.uiService?.showNotification("配車リクエストに失敗しました", "error");
        }
    }

    /**
     * 目的地設定処理（乗車後）
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

            const goalRef = ref(rtdb, 'robot/goal');
            await set(goalRef, {
                x: lat,
                y: lng
            });

            console.log(`📍 Realtime Database に目標座標を設定: (${lat}, ${lng})`);

            await updateDoc(robotDocRef, {
                status: this.STATUS.MOVING,
                destination: new GeoPoint(lat, lng),
                last_updated: new Date().toISOString()
            });

            this.uiService?.showNotification(
                `目的地を設定しました`,
                "success"
            );

            // UIステータスバー表示
            this.uiService?.showStatusBar('moving');

        } catch (error) {
            console.error("❌ 目的地設定エラー:", error);
            this.uiService?.showNotification("目的地の設定に失敗しました。", "error");
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

            const goalRef = ref(rtdb, 'robot/goal');
            await set(goalRef, null);

            delete this.lastProcessedDestinations[robotId];
            delete this.destinationProcessingLock[robotId];

            this.uiService?.showNotification(`ロボット ${robotId} を停止しました`, "warning");
            this.uiService?.hideStatusBar();

        } catch (error) {
            console.error("❌ 緊急停止エラー:", error);
            this.uiService?.showNotification("停止処理に失敗しました", "error");
        }
    }

    cleanup() {
        console.log("🧹 RobotService クリーンアップ完了");
        this.lastUpdateCache = {};
        this.lastProcessedDestinations = {};
        this.destinationProcessingLock = {};
    }
}