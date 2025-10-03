import { initializeAuth } from './config/firebase.js';
import { MapService } from './services/mapService.js';
import { RobotService } from './services/robotService.js';
import { UIService } from './services/uiService.js';
import { SensorDashboard } from './services/sensorDashboard.js'; // 🚀 SensorDashboard をインポート

/**
 * メインアプリケーションクラス
 */
class MobilityApp {
    constructor() {
        this.mapService = null;
        this.robotService = null;
        this.uiService = null;
        this.sensorDashboard = null; // 🚀 プロパティに追加
        this.isInitialized = false;
    }

    /**
     * アプリケーションを初期化
     */
    async initialize() {
        try {
            console.log('Mobility Appを初期化しています...');

            // Google Maps APIがロードされるのを待つ
            await this.waitForGoogleMaps();
            
            // サービス初期化
            this.mapService = new MapService();
            this.sensorDashboard = new SensorDashboard(this.mapService); 
            
            // 🚀 修正後の順序とロジック
            // 1. UIService を初期化。ただし、RobotService はまだないので null を渡す。
            this.uiService = new UIService(null, this.mapService);
            
            // 2. RobotService を初期化。MapService, UIService, SensorDashboard を渡す。
            this.robotService = new RobotService(this.mapService, this.uiService, this.sensorDashboard);

            // 3. 依存関係を解決: UIService に RobotService の参照を渡す。
            //    🚨 このメソッドがエラーの原因だったので、UIService にこのメソッドを追加します。
            this.uiService.setRobotService(this.robotService); // 修正後、この行は正常に動作するようになります。
            
            // マップの初期化
            this.initializeMap();

            // Firebase認証を初期化
            initializeAuth(() => {
                this.onAuthSuccess();
            });

            console.log('Mobility App初期化完了');
        } catch (error) {
            console.error('アプリケーション初期化エラー:', error);
            alert('アプリケーションの初期化に失敗しました。ページを再読み込みしてください。');
        }
    }

    /**
     * Google Maps APIのロードを待つPromise
     */
    waitForGoogleMaps() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 100; // 10秒待機（100 * 100ms）
            
            const checkApi = () => {
                if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
                    console.log('Google Maps API読み込み完了');
                    resolve();
                } else if (attempts >= maxAttempts) {
                    reject(new Error('Google Maps APIの読み込みがタイムアウトしました'));
                } else {
                    attempts++;
                    setTimeout(checkApi, 100);
                }
            };
            checkApi();
        });
    }

    /**
     * マップの初期化
     */
    initializeMap() {
        if (!this.mapService) {
            console.error('MapServiceが初期化されていません');
            return;
        }

        this.mapService.initializeMap('map', (location) => {
            this.uiService.handleMapClick(location);
        });
        console.log('Google Maps初期化完了');
    }

    /**
     * 認証成功時の処理
     */
    onAuthSuccess() {
        console.log('認証が完了しました。リアルタイム更新を開始します。');
        this.robotService.startRealtimeUpdates();
        this.isInitialized = true;
        
        // デバッグ用：10秒後にデバッグ情報を表示
        setTimeout(() => {
            if (this.uiService) {
                this.uiService.showDebugInfo();
            }
        }, 10000);
    }

    /**
     * アプリケーションの状態を取得
     * @returns {Object} アプリケーション状態
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            services: {
                mapService: !!this.mapService,
                robotService: !!this.robotService,
                uiService: !!this.uiService,
                sensorDashboard: !!this.sensorDashboard // 🚀 ダッシュボードの状態を追加
            },
            activeMarkers: this.mapService ? Object.keys(this.mapService.activeMarkers).length : 0,
            activeSimulations: this.robotService ? Object.keys(this.robotService.activeSimulations).length : 0,
            userMarker: this.mapService ? (this.mapService.userMarker ? 'Present' : 'None') : 'Unknown',
            mapInitialized: this.mapService ? !!this.mapService.map : false
        };
    }

    /**
     * アプリケーション終了処理
     */
    shutdown() {
        console.log('Mobility Appをシャットダウンしています...');
        
        if (this.robotService) {
            this.robotService.stopAllSimulations();
        }
        
        if (this.uiService) {
            this.uiService.cleanup();
        }

        // 🚀 ダッシュボードのクリーンアップを追加
        if (this.sensorDashboard) {
            this.sensorDashboard.cleanup();
        }
        
        this.isInitialized = false;
        console.log('Mobility Appシャットダウン完了');
    }

    /**
     * 手動デバッグ情報表示
     */
    showDebug() {
        console.log('=== Manual Debug Info ===');
        console.log('App Status:', this.getStatus());
        if (this.uiService) {
            this.uiService.showDebugInfo();
        }
        console.log('=== End Manual Debug ===');
    }
}

// グローバルスコープでアプリケーションインスタンスを作成
const mobilityApp = new MobilityApp();

// Google Maps APIのコールバック関数をグローバルスコープに公開
window.initMap = () => {
    // Google Maps APIから呼び出される場合は何もしない
    // 実際の初期化はDOMContentLoaded時に行う
    console.log('Google Maps APIコールバックが呼び出されました');
};

// デバッグ用関数をグローバルスコープに公開
window.getMobilityAppStatus = () => {
    return mobilityApp.getStatus();
};

window.showMobilityAppDebug = () => {
    mobilityApp.showDebug();
};

// 手動でアプリを再初期化する関数（デバッグ用）
window.reinitializeMobilityApp = () => {
    mobilityApp.shutdown();
    setTimeout(() => {
        mobilityApp.initialize();
    }, 1000);
};

// ページロード時にアプリケーションを初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM読み込み完了、アプリケーション初期化を開始');
    mobilityApp.initialize();
});

// ページ離脱時にクリーンアップ
window.addEventListener('beforeunload', () => {
    mobilityApp.shutdown();
});

// エラー処理の強化
window.addEventListener('error', (event) => {
    console.error('グローバルエラー:', event.error);
    console.error('ファイル:', event.filename, '行:', event.lineno);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('未処理のPromiseリジェクション:', event.reason);
    event.preventDefault(); // エラーがブラウザのコンソールに表示されるのを防ぐ
});

export default mobilityApp;