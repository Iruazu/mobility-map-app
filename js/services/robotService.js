import { db, collection, onSnapshot, doc, updateDoc, getDoc, getDocs, GeoPoint, deleteField } from '../config/firebase.js';
import { getDistance } from '../utils/geoUtils.js';

/**
 * ロボット制御サービス
 */
export class RobotService {
    constructor(mapService) {
        this.mapService = mapService;
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
                    this.mapService.createRobotMarker(docId, robot);
                } else if (change.type === "removed") {
                    this.mapService.removeMarker(docId);
                }
            });
        }, (error) => {
            console.error("リアルタイム更新エラー:", error);
            alert("データベース接続に問題があります。ページを再読み込みしてください。");
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
            if (action === 'ride') {
                await updateDoc(robotDocRef, { status: '使用中' });
                this.mapService.removeUserMarker(); // 乗車したらユーザーマーカーを消す
                console.log(`ロボット ${docId} に乗車しました`);
            } else { // getoff
                await updateDoc(robotDocRef, { status: 'アイドリング中' });
                console.log(`ロボット ${docId} から降車しました`);
            }
            
            // InfoWindowを閉じる
            if (this.mapService.activeInfoWindow) {
                this.mapService.activeInfoWindow.close();
            }
        } catch (error) {
            console.error("乗車/降車処理エラー:", error);
            alert("操作に失敗しました。再度お試しください。");
        }
    }

    /**
     * ロボット配車処理
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
            
            console.log(`最も近いロボットが見つかりました: ${closestRobot.data.id} (距離: ${minDistance.toFixed(2)}km)`);
            
            const robotDocRef = doc(db, "robots", closestRobot.docId);
            await updateDoc(robotDocRef, {
                status: '配車中',
                destination: new GeoPoint(lat, lng)
            });

            this.calculateAndStartRoute(closestRobot.docId, closestRobot.data.position, { lat, lng });
        } catch (error) {
            console.error("配車処理エラー:", error);
            alert("配車リクエストに失敗しました。再度お試しください。");
        }
    }

    /**
     * 目的地設定処理
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
                alert("ロボットが見つかりません。");
                return;
            }

            const currentPosition = robotDoc.data().position;
            const destination = { lat, lng };

            // ロボットの状態を「走行中」にし、最終目的地を設定
            await updateDoc(robotDocRef, {
                status: '走行中',
                destination: new GeoPoint(destination.lat, destination.lng)
            });

            // 現在地から最終目的地までの経路を計算・表示
            this.calculateAndStartRoute(robotDocId, currentPosition, destination);
        } catch (error) {
            console.error("目的地設定エラー:", error);
            alert("目的地の設定に失敗しました。再度お試しください。");
        }
    }

    /**
     * 経路計算と移動シミュレーション開始
     * @param {string} robotDocId - ロボットのドキュメントID
     * @param {Object} origin - 出発地点
     * @param {Object} destination - 目的地
     */
    calculateAndStartRoute(robotDocId, origin, destination) {
        this.mapService.displayRoute(origin, destination, (path) => {
            this.startMovementSimulation(robotDocId, path);
        });
    }

    /**
     * ロボットの移動シミュレーションを開始
     * @param {string} robotId - ロボットID
     * @param {Array} path - 移動経路の配列
     */
    startMovementSimulation(robotId, path) {
        // 既存のシミュレーションがあればクリア
        if (this.activeSimulations[robotId]) {
            clearInterval(this.activeSimulations[robotId]);
        }

        let step = 0;
        const simulationInterval = 1000; // 1秒間隔
        
        console.log(`ロボット ${robotId} の移動シミュレーション開始 (${path.length}ステップ)`);

        this.activeSimulations[robotId] = setInterval(async () => {
            try {
                if (step >= path.length) {
                    // 移動完了処理
                    await this.handleMovementComplete(robotId);
                    return;
                }

                const nextPosition = path[step];
                await updateDoc(doc(db, "robots", robotId), {
                    position: new GeoPoint(nextPosition.lat(), nextPosition.lng())
                });
                
                console.log(`ロボット ${robotId} 移動: ステップ ${step + 1}/${path.length}`);
                step++;
            } catch (error) {
                console.error(`ロボット ${robotId} の移動エラー:`, error);
                this.stopMovementSimulation(robotId);
            }
        }, simulationInterval);
    }

    /**
     * 移動完了時の処理
     * @param {string} robotId - ロボットID
     */
    async handleMovementComplete(robotId) {
        try {
            // シミュレーション停止
            this.stopMovementSimulation(robotId);
            
            const robotDocRef = doc(db, "robots", robotId);
            const robotDoc = await getDoc(robotDocRef);
            if (!robotDoc.exists()) return;

            const currentStatus = robotDoc.data().status;
            
            // 配車完了ならアイドリング、目的地到着なら使用中に戻す
            const finalStatus = currentStatus === '配車中' ? 'アイドリング中' : '使用中';

            await updateDoc(robotDocRef, {
                status: finalStatus,
                destination: deleteField()
            });

            // 経路表示をクリア
            this.mapService.clearRoute();
            
            if (finalStatus === 'アイドリング中') {
                // 配車完了時
                this.mapService.removeUserMarker();
                console.log(`ロボット ${robotId} が配車完了しました`);
            } else {
                // 目的地到着時
                alert('目的地に到着しました。');
                console.log(`ロボット ${robotId} が目的地に到着しました`);
            }
        } catch (error) {
            console.error("移動完了処理エラー:", error);
        }
    }

    /**
     * 移動シミュレーションを停止
     * @param {string} robotId - ロボットID
     */
    stopMovementSimulation(robotId) {
        if (this.activeSimulations[robotId]) {
            clearInterval(this.activeSimulations[robotId]);
            delete this.activeSimulations[robotId];
            console.log(`ロボット ${robotId} の移動シミュレーション停止`);
        }
    }

    /**
     * 使用中のロボットを取得
     * @returns {Promise<Object|null>} 使用中のロボットまたはnull
     */
    async getInUseRobot() {
        try {
            const robotsCol = collection(db, 'robots');
            const robotSnapshot = await getDocs(robotsCol);
            const inUseRobotDoc = robotSnapshot.docs.find(doc => doc.data().status === '使用中');
            return inUseRobotDoc ? { id: inUseRobotDoc.id, data: inUseRobotDoc.data() } : null;
        } catch (error) {
            console.error("使用中ロボット取得エラー:", error);
            return null;
        }
    }

    /**
     * 全てのアクティブなシミュレーションを停止
     */
    stopAllSimulations() {
        Object.keys(this.activeSimulations).forEach(robotId => {
            this.stopMovementSimulation(robotId);
        });
    }
}