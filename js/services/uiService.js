/**
 * UI制御サービス
 */
export class UIService {
    // 🚀 constructor は、main.js からの呼び出し順序に合わせて robotService を受け取る
    constructor(robotService, mapService) {
        this.robotService = robotService; // 初期化時は null の可能性がある
        this.mapService = mapService;
        this.setupGlobalHandlers();
    }

    /**
     * 後から RobotService の参照を設定する (main.js の初期化順序の問題を解決)
     * @param {RobotService} robotService - RobotService のインスタンス
     */
    setRobotService(robotService) {
        // 🚨 main.js の TypeError を解消するために必須のメソッド
        this.robotService = robotService;
        console.log("UIService: RobotService の参照を解決しました。");
    }

    /**
     * グローバル関数ハンドラーを設定
     */
    setupGlobalHandlers() {
        // グローバル関数として公開（HTMLのonclickから呼び出されるため）
        window.handleRideButtonClick = (docId, action) => {
            // 🚨 this.robotService が null の場合があるためチェック
            if (this.robotService) {
                this.handleRideButtonClick(docId, action);
            }
        };

        window.handleCallRobotClick = (lat, lng) => {
             if (this.robotService) {
                this.handleCallRobotClick(lat, lng);
            }
        };

        window.handleSetDestinationClick = (robotDocId, lat, lng) => {
             if (this.robotService) {
                this.handleSetDestinationClick(robotDocId, lat, lng);
            }
        };
    }

    /**
     * 乗車/降車ボタンクリック処理
     * @param {string} docId - ドキュメントID
     * @param {string} action - アクション
     */
    async handleRideButtonClick(docId, action) {
        try {
            await this.robotService.handleRideAction(docId, action);
            
            // 成功メッセージを表示
            const message = action === 'ride' ? '乗車しました。地図をクリックして目的地を設定してください。' : '降車しました。';
            this.showSuccessMessage(message);
        } catch (error) {
            console.error('乗車/降車処理エラー:', error);
            this.showErrorMessage('操作に失敗しました。再度お試しください。');
        }
    }

    /**
     * ロボット呼び出しボタンクリック処理
     * @param {number} lat - 緯度
     * @param {number} lng - 経度
     */
    async handleCallRobotClick(lat, lng) {
        try {
            this.showLoadingMessage('ロボットを呼んでいます...');
            await this.robotService.callRobot(lat, lng);
            this.hideLoadingMessage();
            // 成功メッセージは RobotService 内で処理されるか、ROS2からのフィードバックを待つべきですが、ここでは簡略化
        } catch (error) {
            console.error('配車処理エラー:', error);
            this.hideLoadingMessage();
            this.showErrorMessage('配車リクエストに失敗しました。再度お試しください。');
        }
    }

    /**
     * 目的地設定ボタンクリック処理
     * @param {string} robotDocId - ロボットのドキュメントID
     * @param {number} lat - 緯度
     * @param {number} lng - 経度
     */
    async handleSetDestinationClick(robotDocId, lat, lng) {
        try {
            this.showLoadingMessage('経路を計算しています...');
            await this.robotService.setDestination(robotDocId, lat, lng);
            this.hideLoadingMessage();
            this.showSuccessMessage('目的地を設定しました。ロボットが向かっています。');
        } catch (error) {
            console.error('目的地設定エラー:', error);
            this.hideLoadingMessage();
            this.showErrorMessage('目的地の設定に失敗しました。再度お試しください。');
        }
    }

    /**
     * 地図クリック時の処理
     * @param {google.maps.LatLng} location - クリック位置
     */
    async handleMapClick(location) {
        try {
            if (!this.robotService) {
                 this.showErrorMessage('アプリケーションの初期化が完了していません。');
                 return;
            }
            // 現在「使用中」のロボットがいるか確認
            const inUseRobot = await this.robotService.getInUseRobot();

            if (inUseRobot) {
                // 「使用中」のロボットがいる場合 -> 目的地を設定する
                console.log("目的地設定モードです。");
                this.mapService.placeDestinationMarker(location, inUseRobot.id);
            } else {
                // 「使用中」のロボットがいない場合 -> ロボットを呼ぶ
                console.log("配車リクエストモードです。");
                this.mapService.placePickupMarker(location);
            }
        } catch (error) {
            console.error('地図クリック処理エラー:', error);
            this.showErrorMessage('操作に失敗しました。再度お試しください。');
        }
    }

    /**
     * 成功メッセージを表示
     * @param {string} message - メッセージ
     */
    showSuccessMessage(message) {
        this.showToast(message, 'success');
    }

    /**
     * エラーメッセージを表示
     * @param {string} message - メッセージ
     */
    showErrorMessage(message) {
        this.showToast(message, 'error');
    }

    /**
     * ローディングメッセージを表示
     * @param {string} message - メッセージ
     */
    showLoadingMessage(message) {
        this.removeExistingToast();
        const toast = this.createToast(message, 'loading');
        document.body.appendChild(toast);
    }

    /**
     * ローディングメッセージを非表示
     */
    hideLoadingMessage() {
        this.removeExistingToast();
    }

    /**
     * トーストメッセージを表示
     * @param {string} message - メッセージ
     * @param {string} type - タイプ ('success', 'error', 'loading')
     */
    showToast(message, type = 'info') {
        this.removeExistingToast();
        
        const toast = this.createToast(message, type);
        document.body.appendChild(toast);

        // 自動削除（ローディング以外）
        if (type !== 'loading') {
            setTimeout(() => {
                this.removeExistingToast();
            }, 3000);
        }
    }

    /**
     * トースト要素を作成
     * @param {string} message - メッセージ
     * @param {string} type - タイプ
     * @returns {HTMLElement} トースト要素
     */
    createToast(message, type) {
        const toast = document.createElement('div');
        toast.id = 'mobility-toast';
        
        const baseClasses = 'fixed top-4 right-4 px-4 py-2 rounded-md shadow-lg z-50 transition-opacity duration-300';
        let typeClasses = '';
        
        switch (type) {
            case 'success':
                typeClasses = 'bg-green-500 text-white';
                break;
            case 'error':
                typeClasses = 'bg-red-500 text-white';
                break;
            case 'loading':
                typeClasses = 'bg-blue-500 text-white';
                message = `⏳ ${message}`;
                break;
            default:
                typeClasses = 'bg-gray-500 text-white';
        }
        
        toast.className = `${baseClasses} ${typeClasses}`;
        toast.textContent = message;
        
        return toast;
    }

    /**
     * 既存のトーストを削除
     */
    removeExistingToast() {
        const existingToast = document.getElementById('mobility-toast');
        if (existingToast) {
            existingToast.remove();
        }
    }

    /**
     * アプリケーション終了時のクリーンアップ
     */
    cleanup() {
        this.removeExistingToast();
        
        // グローバル関数を削除
        delete window.handleRideButtonClick;
        delete window.handleCallRobotClick;
        delete window.handleSetDestinationClick;
    }

    /**
     * デバッグ情報を表示
     */
    showDebugInfo() {
        console.log('=== Mobility App Debug Info ===');
        console.log('Active Markers:', Object.keys(this.mapService.activeMarkers).length);
        console.log('Active Simulations:', Object.keys(this.robotService.activeSimulations).length);
        console.log('User Marker:', this.mapService.userMarker ? 'Present' : 'None');
        console.log('=== End Debug Info ===');
    }
}