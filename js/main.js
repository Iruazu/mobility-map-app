import { initializeAuth } from './config/firebase.js';
import { MapService } from './services/mapService.js';
import { RobotService } from './services/robotService.js';
import { UIService } from './services/uiService.js';
import { SensorDashboard } from './services/sensorDashboard.js';

/**
 * メインアプリケーションクラス
 */
class MobilityApp {
    constructor() {
        this.mapService = null;
        this.robotService = null;
        this.uiService = null;
        this.sensorDashboard = null;
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
            
            // UIService を初期化。ただし、RobotService はまだないので null を渡す。
            this.uiService = new UIService(null, this.mapService);
            
            // RobotService を初期化。MapService, UIService, SensorDashboard を渡す。
            this.robotService = new RobotService(this.mapService, this.uiService, this.sensorDashboard);

            // 依存関係を解決: UIService に RobotService の参照を渡す。
            this.uiService.setRobotService(this.robotService);
            
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
     * Google Maps APIを動的に読み込み、完全に初期化されるまで待つPromise
     */
    async waitForGoogleMaps() {
        try {
            // APIキーをインポート
            const { API_KEYS } = await import('./config/apiKeys.js');
            
            return new Promise((resolve, reject) => {
                // 既に完全に読み込まれている場合
                if (typeof google !== 'undefined' && 
                    typeof google.maps !== 'undefined' && 
                    typeof google.maps.Map === 'function') {
                    console.log('Google Maps API は既に読み込まれています');
                    resolve();
                    return;
                }
                
                // Google Maps APIスクリプトを作成
                const script = document.createElement('script');
                script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEYS.GOOGLE_MAPS}&loading=async&libraries=marker&callback=initGoogleMapsCallback`;
                script.async = true;
                script.defer = true;
                
                // グローバルコールバック関数を設定
                window.initGoogleMapsCallback = () => {
                    console.log('Google Maps APIコールバック実行');
                    
                    // google.maps.Mapが使用可能になるまで待つ
                    const checkInterval = setInterval(() => {
                        if (typeof google !== 'undefined' && 
                            typeof google.maps !== 'undefined' && 
                            typeof google.maps.Map === 'function') {
                            clearInterval(checkInterval);
                            console.log('Google Maps API読み込み完了');
                            resolve();
                        }
                    }, 50);
                    
                    // タイムアウト（5秒）
                    setTimeout(() => {
                        clearInterval(checkInterval);
                        if (typeof google === 'undefined' || typeof google.maps.Map !== 'function') {
                            reject(new Error('Google Maps APIの初期化がタイムアウトしました'));
                        }
                    }, 5000);
                };
                
                script.onerror = () => {
                    reject(new Error('Google Maps APIスクリプトの読み込みに失敗しました'));
                };
                
                document.head.appendChild(script);
                
                // 全体のタイムアウト設定（15秒）
                setTimeout(() => {
                    if (typeof google === 'undefined' || typeof google.maps.Map !== 'function') {
                        reject(new Error('Google Maps APIの読み込みがタイムアウトしました（15秒）'));
                    }
                }, 15000);
            });
        } catch (error) {
            console.error('APIキーの読み込みエラー:', error);
            throw error;
        }
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
                sensorDashboard: !!this.sensorDashboard
            },
            activeMarkers: this.mapService ? Object.keys(this.mapService.activeMarkers).length : 0,
            activeSimulations: this.robotService ? Object.keys(this.robotService.activeSimulations || {}).length : 0,
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
            this.robotService.cleanup();
        }
        
        if (this.uiService) {
            this.uiService.cleanup();
        }

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

// Google Maps APIのコールバック関数（フォールバック用）
window.initMap = () => {
    console.log('initMap コールバックが呼び出されました');
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
    event.preventDefault();
});

export default mobilityApp;