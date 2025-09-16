import { initializeAuth } from './config/firebase.js';
import { MapService } from './services/mapService.js';
import { RobotService } from './services/robotService.js';
import { UIService } from './services/uiService.js';

/**
 * メインアプリケーションクラス
 */
class MobilityApp {
    constructor() {
        this.mapService = null;
        this.robotService = null;
        this.uiService = null;
        this.isInitialized = false;
    }

    /**
     * アプリケーションを初期化
     */
    async initialize() {
        try {
            console.log('Mobility Appを初期化しています...');

            // Google Maps APIがロードされるのを待つ
            // DOMContentLoadedイベント内でこの処理を実行
            await this.waitForGoogleMaps();
            
            // サービス初期化
            this.mapService = new MapService();
            this.robotService = new RobotService(this.mapService);
            this.uiService = new UIService(this.robotService, this.mapService);
            
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
            const checkApi = () => {
                if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
                    resolve();
                } else {
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
            this.uiService.showDebugInfo();
        }, 10000);
    }

    // getStatus, shutdown, その他のメソッドは変更なし
    // ...
}

// グローバルスコープでアプリケーションインスタンスを作成
const mobilityApp = new MobilityApp();

// Google Maps APIのコールバック関数をグローバルスコープに公開
window.initMap = () => {
    mobilityApp.initMap();
};

// デバッグ用：アプリケーション状態をコンソールで確認
window.getMobilityAppStatus = () => {
    return mobilityApp.getStatus();
};

// ページロード時にアプリケーションを初期化
document.addEventListener('DOMContentLoaded', () => {
    mobilityApp.initialize();
});

// ページ離脱時にクリーンアップ
window.addEventListener('beforeunload', () => {
    mobilityApp.shutdown();
});

// エラー処理
window.addEventListener('error', (event) => {
    console.error('グローバルエラー:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('未処理のPromiseリジェクション:', event.reason);
});

export default mobilityApp;