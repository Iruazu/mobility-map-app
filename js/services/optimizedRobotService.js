import { db, collection, onSnapshot, doc, updateDoc, getDoc, getDocs, GeoPoint, deleteField } from '../config/firebase.js';
import { getDistance } from '../utils/geoUtils.js';
import { PerformanceConfig, PerformanceMetrics, AdaptivePerformance } from '../config/performance.js';

/**
 * パフォーマンス最適化されたロボット制御サービス
 */
export class OptimizedRobotService {
    constructor(mapService) {
        this.mapService = mapService;
        this.activeSimulations = {};
        this.metrics = new PerformanceMetrics();
        this.adaptivePerf = new AdaptivePerformance();
        this.updateQueue = new Map(); // 更新キュー
        this.lastPositions = new Map(); // 最後の位置を記憶
        this.robotSpeeds = new Map(); // ロボットの速度を記録
        
        // バッチ更新処理を開始
        this.startBatchProcessor();
        
        // メモリクリーンアップを開始
        this.startMemoryCleanup();
        
        // パフォーマンス監視を開始
        this.startPerformanceMonitoring();
    }

    /**
     * Firestoreのリアルタイム更新を開始する
     */
    startRealtimeUpdates() {
        const robotsCol = collection(db, 'robots');
        onSnapshot(robotsCol, (snapshot) => {
            const startTime = performance.now();
            console.log("データベースが更新されました！");
            
            snapshot.docChanges().forEach((change) => {
                const docId = change.doc.id;
                const robot = change.doc.data();

                if (change.type === "added" || change.type === "modified") {
                    // 重要でない更新をフィルタリング
                    if (this.shouldUpdateMarker(docId, robot)) {
                        this.mapService.createRobotMarker(docId, robot);
                        this.metrics.incrementUpdate('total');
                    } else {
                        this.metrics.incrementUpdate('skipped');
                    }
                } else if (change.type === "removed") {
                    this.mapService.removeMarker(docId);
                    this.lastPositions.delete(docId);
                    this.robotSpeeds.delete(docId);
                }
            });
            
            const duration = performance.now() - startTime;
            this.metrics.recordUpdateTime(duration);
        }, (error) => {
            console.error("リアルタイム更新エラー:", error);
            alert("データベース接続に問題があります。ページを再読み込みしてください。");
        });
    }

    /**
     * マーカー更新が必要かどうかを判定
     * @param {string} docId - ドキュメントID
     * @param {Object} robot - ロボットデータ
     * @returns {boolean} 更新が必要かどうか
     */
    shouldUpdateMarker(docId, robot) {
        if (!robot.position?.latitude || !robot.position?.longitude) {
            return false;
        }

        const lastPosition = this.lastPositions.get(docId);
        const currentPos = { lat: robot.position.latitude, lng: robot.position.longitude };

        // 初回は必ず更新
        if (!lastPosition) {
            this.lastPositions.set(docId, { ...currentPos, timestamp: Date.now() });
            return true;
        }

        // 距離ベースのフィルタリング
        const distance = getDistance(lastPosition, currentPos);
        const config = this.adaptivePerf.getCurrentConfig();
        
        // 最小移動距離未満の場合はスキップ
        if (distance < config.simulation.distanceThreshold.minimum / 1000) { // kmに変換
            return false;
        }

        // 重要な移動距離以上の場合は必ず更新
        if (distance >= config.simulation.distanceThreshold.significant / 1000) {
            this.updateLastPosition(docId, currentPos);
            return true;
        }

        // 時間ベースのフィルタリング
        const timeDiff = Date.now() - lastPosition.timestamp;
        const minInterval = config.ui.markerUpdate.minInterval;
        
        if (timeDiff < minInterval) {
            return false;
        }

        this.updateLastPosition(docId, currentPos);
        return true;
    }

    /**
     * 最後の位置情報を更新
     * @param {string} docId - ドキュメントID
     * @param {Object} position - 位置情報
     */
    updateLastPosition(docId, position) {
        this.lastPositions.set(docId, { ...position, timestamp: Date.now() });
    }

    /**
     * ロボットの移動シミュレーションを開始（最適化版）
     * @param {string} robotId - ロボットID
     * @param {Array} path - 移動経路の配列
     * @param {string} status - ロボットの状態
     */
    startOptimizedMovementSimulation(robotId, path, status = '走行中') {
        // 既存のシミュレーションがあればクリア
        if (this.activeSimulations[robotId]) {
            clearInterval(this.activeSimulations[robotId].interval);
        }

        const config = this.adaptivePerf.getCurrentConfig();
        let step = 0;
        let simulationInterval = config.simulation.intervals[status] || 1000;
        
        console.log(`ロボット ${robotId} の最適化移動シミュレーション開始 (${path.length}ステップ, 間隔: ${simulationInterval}ms)`);

        // 速度計算用の変数
        let lastUpdateTime = Date.now();
        let lastPosition = path[0];

        const simulationData = {
            interval: setInterval(async () => {
                try {
                    if (step >= path.length) {
                        await this.handleMovementComplete(robotId);
                        return;
                    }

                    const currentTime = Date.now();
                    const nextPosition = path[step];
                    
                    // 速度計算
                    if (step > 0) {
                        const distance = getDistance(
                            { lat: lastPosition.lat(), lng: lastPosition.lng() },
                            { lat: nextPosition.lat(), lng: nextPosition.lng() }
                        );
                        const timeDiff = (currentTime - lastUpdateTime) / 1000 / 3600; // 時間に変換
                        const speed = distance / timeDiff; // km/h
                        
                        this.robotSpeeds.set(robotId, speed);
                        
                        // 速度に基づく動的間隔調整
                        if (config.simulation.speedBased.enabled) {
                            if (speed < config.simulation.speedBased.slowSpeed) {
                                simulationInterval = Math.min(simulationInterval * 1.2, 3000);
                            } else if (speed > config.simulation.speedBased.fastSpeed) {
                                simulationInterval = Math.max(simulationInterval * 0.8, 500);
                            }
                        }
                    }

                    // 効率的な位置更新（キューを使用）
                    this.queuePositionUpdate(robotId, nextPosition);
                    
                    console.log(`ロボット ${robotId} 移動: ステップ ${step + 1}/${path.length} (速度: ${this.robotSpeeds.get(robotId)?.toFixed(1) || 0}km/h)`);
                    
                    lastPosition = nextPosition;
                    lastUpdateTime = currentTime;
                    step++;
                    
                } catch (error) {
                    console.error(`ロボット ${robotId} の移動エラー:`, error);
                    this.stopMovementSimulation(robotId);
                }
            }, simulationInterval),
            
            startTime: Date.now(),
            totalSteps: path.length,
            currentStep: step
        };

        this.activeSimulations[robotId] = simulationData;
    }

    /**
     * 位置更新をキューに追加
     * @param {string} robotId - ロボットID
     * @param {google.maps.LatLng} position - 位置
     */
    queuePositionUpdate(robotId, position) {
        this.updateQueue.set(robotId, {
            position: new GeoPoint(position.lat(), position.lng()),
            timestamp: Date.now()
        });
    }

    /**
     * バッチ更新プロセッサを開始
     */
    startBatchProcessor() {
        const config = this.adaptivePerf.getCurrentConfig();
        
        if (!config.realtime.batchUpdate.enabled) {
            return;
        }

        setInterval(() => {
            if (this.updateQueue.size > 0) {
                this.processBatchUpdates();
            }
        }, config.realtime.batchUpdate.batchInterval);
    }

    /**
     * バッチ更新を処理
     */
    async processBatchUpdates() {
        const config = this.adaptivePerf.getCurrentConfig();
        const updates = Array.from(this.updateQueue.entries()).slice(0, config.realtime.batchUpdate.maxBatchSize);
        
        if (updates.length === 0) return;

        const startTime = performance.now();
        
        try {
            // 並列更新の実行
            const updatePromises = updates.map(([robotId, data]) => {
                this.updateQueue.delete(robotId);
                return updateDoc(doc(db, "robots", robotId), {
                    position: data.position,
                    lastUpdated: data.timestamp
                });
            });

            await Promise.all(updatePromises);
            
            this.metrics.incrementUpdate('batched');
            const duration = performance.now() - startTime;
            console.log(`バッチ更新完了: ${updates.length}件 (${duration.toFixed(2)}ms)`);
            
        } catch (error) {
            console.error('バッチ更新エラー:', error);
            // エラーが発生した場合、更新を個別に再試行
            updates.forEach(([robotId, data]) => {
                this.updateQueue.set(robotId, data);
            });
        }
    }

    /**
     * メモリクリーンアップを開始
     */
    startMemoryCleanup() {
        const config = this.adaptivePerf.getCurrentConfig();
        
        if (!config.memory.cleanup.enabled) {
            return;
        }

        setInterval(() => {
            this.performMemoryCleanup();
        }, config.memory.cleanup.interval);
    }

    /**
     * メモリクリーンアップを実行
     */
    performMemoryCleanup() {
        const config = this.adaptivePerf.getCurrentConfig();
        const now = Date.now();
        
        // 古い位置履歴を削除
        for (const [robotId, posData] of this.lastPositions.entries()) {
            if (now - posData.timestamp > config.memory.historyRetention.positions) {
                this.lastPositions.delete(robotId);
            }
        }
        
        // 古い速度データを削除
        for (const [robotId, _] of this.robotSpeeds.entries()) {
            if (!this.lastPositions.has(robotId)) {
                this.robotSpeeds.delete(robotId);
            }
        }
        
        console.log(`メモリクリーンアップ完了 - 位置履歴: ${this.lastPositions.size}件, 速度データ: ${this.robotSpeeds.size}件`);
    }

    /**
     * パフォーマンス監視を開始
     */
    startPerformanceMonitoring() {
        setInterval(() => {
            const metrics = this.metrics.getMetrics();
            
            // メトリクスの更新
            metrics.memory.activeMarkers = Object.keys(this.mapService.activeMarkers).length;
            metrics.memory.activeSimulations = Object.keys(this.activeSimulations).length;
            metrics.memory.queuedUpdates = this.updateQueue.size;
            
            // パフォーマンスが悪化している場合、設定を調整
            if (metrics.timing.avgUpdateTime > 100) { // 100ms以上
                console.warn('パフォーマンス低下を検出、設定を調整します');
                this.adaptivePerf.adjustSettings({
                    cpuUsage: 85, // 仮の値
                    memoryUsage: 70,
                    networkLatency: 200
                });
            }
            
        }, 30000); // 30秒ごとに監視
    }

    // 既存のメソッドを最適化版で上書き
    calculateAndStartRoute(robotDocId, origin, destination) {
        this.mapService.displayRoute(origin, destination, (path) => {
            // 経路の簡略化
            const config = this.adaptivePerf.getCurrentConfig();
            let optimizedPath = path;
            
            if (config.ui.routeDisplay.simplification && path.length > config.ui.routeDisplay.maxPoints) {
                optimizedPath = this.simplifyPath(path, config.ui.routeDisplay.maxPoints);
            }
            
            this.startOptimizedMovementSimulation(robotDocId, optimizedPath);
        });
    }

    /**
     * 経路を簡略化
     * @param {Array} path - 元の経路
     * @param {number} maxPoints - 最大ポイント数
     * @returns {Array} 簡略化された経路
     */
    simplifyPath(path, maxPoints) {
        if (path.length <= maxPoints) return path;
        
        const simplified = [path[0]]; // 開始点は必ず含める
        const step = Math.floor(path.length / (maxPoints - 2));
        
        for (let i = step; i < path.length - 1; i += step) {
            simplified.push(path[i]);
        }
        
        simplified.push(path[path.length - 1]); // 終了点は必ず含める
        
        console.log(`経路簡略化: ${path.length} → ${simplified.length}ポイント`);
        return simplified;
    }

    /**
     * パフォーマンスメトリクスを取得
     * @returns {Object} メトリクス情報
     */
    getPerformanceMetrics() {
        const metrics = this.metrics.getMetrics();
        return {
            ...metrics,
            system: {
                lastPositions: this.lastPositions.size,
                robotSpeeds: this.robotSpeeds.size,
                queuedUpdates: this.updateQueue.size,
                activeSimulations: Object.keys(this.activeSimulations).length
            },
            config: this.adaptivePerf.getCurrentConfig()
        };
    }

    // 以下、既存のメソッドをそのまま継承（最適化は上記で実装済み）
    async handleRideAction(docId, action) {
        try {
            const robotDocRef = doc(db, "robots", docId);
            if (action === 'ride') {
                await updateDoc(robotDocRef, { status: '使用中' });
                this.mapService.removeUserMarker();
                console.log(`ロボット ${docId} に乗車しました`);
            } else {
                await updateDoc(robotDocRef, { status: 'アイドリング中' });
                console.log(`ロボット ${docId} から降車しました`);
            }
            
            if (this.mapService.activeInfoWindow) {
                this.mapService.activeInfoWindow.close();
            }
        } catch (error) {
            console.error("乗車/降車処理エラー:", error);
            alert("操作に失敗しました。再度お試しください。");
        }
    }

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

            await updateDoc(robotDocRef, {
                status: '走行中',
                destination: new GeoPoint(destination.lat, destination.lng)
            });

            this.calculateAndStartRoute(robotDocId, currentPosition, destination);
        } catch (error) {
            console.error("目的地設定エラー:", error);
            alert("目的地の設定に失敗しました。再度お試しください。");
        }
    }

    async handleMovementComplete(robotId) {
        try {
            this.stopMovementSimulation(robotId);
            
            const robotDocRef = doc(db, "robots", robotId);
            const robotDoc = await getDoc(robotDocRef);
            if (!robotDoc.exists()) return;

            const currentStatus = robotDoc.data().status;
            const finalStatus = currentStatus === '配車中' ? 'アイドリング中' : '使用中';

            await updateDoc(robotDocRef, {
                status: finalStatus,
                destination: deleteField()
            });

            this.mapService.clearRoute();
            
            if (finalStatus === 'アイドリング中') {
                this.mapService.removeUserMarker();
                console.log(`ロボット ${robotId} が配車完了しました`);
            } else {
                alert('目的地に到着しました。');
                console.log(`ロボット ${robotId} が目的地に到着しました`);
            }
        } catch (error) {
            console.error("移動完了処理エラー:", error);
        }
    }

    stopMovementSimulation(robotId) {
        if (this.activeSimulations[robotId]) {
            clearInterval(this.activeSimulations[robotId].interval);
            delete this.activeSimulations[robotId];
            console.log(`ロボット ${robotId} の移動シミュレーション停止`);
        }
    }

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

    stopAllSimulations() {
        Object.keys(this.activeSimulations).forEach(robotId => {
            this.stopMovementSimulation(robotId);
        });
    }
}