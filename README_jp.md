# Firebase Webインターフェース - パーソナルモビリティプラットフォーム

[![Firebase](https://img.shields.io/badge/Firebase-Firestore-orange.svg)](https://firebase.google.com/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow.svg)](https://www.javascript.com/)
[![Google Maps](https://img.shields.io/badge/Google_Maps-API-blue.svg)](https://developers.google.com/maps)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

自律移動ロボット向けのリアルタイムWebベース制御インターフェース。ライブテレメトリ監視、インタラクティブな地図コントロール、ROS2バックエンドシステムとのシームレスなFirebase統合を実現します。

## 🎯 概要

本Webアプリケーションは、自律配送ロボットをリアルタイムで管理するための直感的な制御インターフェースを提供します。バニラJavaScriptとFirebaseで構築され、軽量かつ強力なフリート監視・制御ソリューションを実現します。

### 主要機能

✅ **リアルタイムロボット追跡**: FirebaseでROS2と同期したライブ位置更新  
✅ **インタラクティブマップ**: カスタムマーカーコントロール付きGoogle Maps統合  
✅ **センサーダッシュボード**: ライブテレメトリ監視（バッテリー、速度、障害物、距離）  
✅ **ワンクリック配車**: 最寄りロボット自動選択による特定地点への呼び出し  
✅ **目的地制御**: ROS2 Nav2経路計画統合によるナビゲーションゴール設定  
✅ **乗降管理**: ステータス同期付きアプリ内乗車/降車コントロール  
✅ **レスポンシブデザイン**: Tailwind CSSスタイリングによるモバイル最適化UI  

---

## 🏗️ システムアーキテクチャ

```
┌─────────────────────────────────────────────────────┐
│           Webブラウザ (クライアント)                 │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │         ユーザーインターフェース層            │  │
│  │  • マップコントロール (Google Maps)          │  │
│  │  • センサーダッシュボード (テレメトリ表示)   │  │
│  │  • 通知システム                              │  │
│  └──────────────────────────────────────────────┘  │
│                      ▲                              │
│                      │                              │
│  ┌──────────────────────────────────────────────┐  │
│  │         サービス層                           │  │
│  │  • MapService (マーカー管理)                 │  │
│  │  • RobotService (状態制御)                   │  │
│  │  • UIService (イベント処理)                  │  │
│  │  • SensorDashboard (テレメトリ描画)          │  │
│  └──────────────────────────────────────────────┘  │
│                      ▲                              │
└──────────────────────┼──────────────────────────────┘
                       │ Firestore SDK
                       │ リアルタイムリスナー
┌──────────────────────▼──────────────────────────────┐
│             Firebase Firestore                      │
│  コレクション: robots                               │
│  • position (GeoPoint)                              │
│  • status (idle/in_use/moving/dispatching)          │
│  • destination (GeoPoint, nullable)                 │
│  • telemetry (Object)                               │
└──────────────────────┬──────────────────────────────┘
                       │
                       │ Firebase Bridgeノード
┌──────────────────────▼──────────────────────────────┐
│              ROS2 バックエンドシステム               │
│  • Navigation2 (経路計画)                           │
│  • AMCL (自己位置推定)                              │
│  • センサードライバー (LiDAR, IMU, オドメトリ)      │
└─────────────────────────────────────────────────────┘
```

---

## 📋 前提条件

### 必要なサービス

1. **Firebaseプロジェクト**
   - Firestoreデータベース（ネイティブモード）
   - Web SDK設定済み
   - 認証有効化（匿名サインイン）

2. **Google Maps API**
   - Maps JavaScript API有効化
   - Markerライブラリ有効化
   - 適切な制限付きAPIキー

3. **ROS2バックエンド** (開発時はオプション)
   - ROS2 Firebase Bridge実行中
   - Firestore書き込み権限設定済み

### 開発ツール

- モダンWebブラウザ (Chrome, Firefox, Edge)
- Node.js 16+ (オプション、ローカルサーバー用)
- VS Code + Live Server拡張機能 (推奨)

---

## 🚀 クイックスタート

### 1. リポジトリのクローン

```bash
git clone https://github.com/yourusername/mobility-web-interface.git
cd mobility-web-interface
```

### 2. Firebase設定

`js/config/firebase.js`を作成し、Firebase認証情報を追加:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456",
    measurementId: "G-XXXXXXXXXX"
};
```

### 3. Google Maps API設定

ルートディレクトリに`apiKey.js`を作成:

```javascript
const GOOGLE_API_KEY = "YOUR_GOOGLE_MAPS_API_KEY";
```

### 4. アプリケーションの起動

**方法A: Live Server使用 (VS Code)**
1. "Live Server"拡張機能をインストール
2. `index.html`を右クリック
3. "Open with Live Server"を選択

**方法B: Python HTTPサーバー使用**
```bash
python3 -m http.server 8000
# http://localhost:8000 にアクセス
```

**方法C: Node.js使用**
```bash
npx http-server -p 8000
```

---

## 📦 プロジェクト構造

```
mobility-web-interface/
├── index.html                      # メインエントリポイント
├── style.css                       # グローバルスタイル
├── dashboard-styles.css            # センサーダッシュボードスタイル
├── apiKey.js                       # Google Maps APIキー (gitignore対象)
├── js/
│   ├── main.js                     # アプリケーションブートストラップ
│   ├── config/
│   │   └── firebase.js             # Firebase設定
│   ├── services/
│   │   ├── mapService.js           # マップ・マーカー管理
│   │   ├── robotService.js         # ロボット状態制御
│   │   ├── uiService.js            # UIイベント処理
│   │   └── sensorDashboard.js      # テレメトリダッシュボード
│   └── utils/
│       └── geoUtils.js             # 地理計算
├── .gitignore
└── README.md
```

---

## 🔧 コアコンポーネント

### 1. MapService (`js/services/mapService.js`)

Google Maps統合とマーカーライフサイクルを管理。

**主要機能:**
- **スマートマーカー更新**: 不要な再描画を防ぐ1.1m許容誤差付き位置キャッシング
- **カスタムピン要素**: ロボットステータスに基づく色分けマーカー
- **InfoWindow管理**: アクションボタン付きコンテキスト対応ポップアップ
- **ユーザーインタラクション**: 乗車地点/目的地マーカー配置

**ステータス別マーカー色:**
```javascript
idle        → 青 (#2196F3)
in_use      → オレンジ (#f59e0b)
moving      → 緑 (#4CAF50)
dispatching → 紫 (#8b5cf6)
```

**使用例:**
```javascript
const mapService = new MapService();
mapService.initializeMap('map', (location) => {
    console.log('地図クリック:', location);
});

// ロボットマーカー更新
mapService.updateRobotMarker('robot_001', {
    id: 'robot_001',
    position: { latitude: 36.55077, longitude: 139.92957 },
    status: 'moving'
});
```

### 2. RobotService (`js/services/robotService.js`)

ロボット状態を制御し、Firebaseバックエンドと通信。

**主な責務:**
- Firestoreリアルタイムリスナー設定
- ロボット配車ロジック（最寄りロボット選択）
- 検証付き目的地設定
- ステータス管理（idle/in_use/moving/dispatching）
- 過剰なレンダリングを防ぐ更新スロットリング（500ms）

**更新最適化:**
```javascript
// 以下の場合のみ更新処理:
// 1. ステータス変更
// 2. destination変更 (>0.00001° ≈ 1m)
// 3. position変更 (>0.00001° ≈ 1m)
// 4. 前回更新から500ms以上経過
```

**使用例:**
```javascript
// 最寄りロボットを呼ぶ
await robotService.callRobot(36.55080, 139.92960);

// 使用中ロボットの目的地設定
await robotService.setDestination('robot_001', 36.55085, 139.92965);

// 乗車/降車
await robotService.handleRideAction('robot_001', 'ride');
```

### 3. SensorDashboard (`js/services/sensorDashboard.js`)

リアルタイムテレメトリ可視化ダッシュボード。

**監視メトリクス:**
- **バッテリー**: パーセンテージ、電圧、充電状態（色分けバー付き）
- **速度**: 現在速度（m/s）
- **目的地までの距離**: ナビゲーション目標までの残距離
- **障害物検知**: LiDARベースの障害物接近アラート

**機能:**
- 折りたたみ可能パネル（トグルボタン）
- 自動更新タイムスタンプ
- 色分けアラート（緑/黄/赤）
- レスポンシブグリッドレイアウト

**テレメトリデータ形式:**
```javascript
{
    battery_percent: 85.5,
    battery_voltage: 12.6,
    battery_charging: false,
    speed: 0.22,
    distance_to_goal: 3.42,
    obstacle_detected: false,
    min_obstacle_distance: 2.35
}
```

### 4. UIService (`js/services/uiService.js`)

ユーザーインタラクションと通知システムを処理。

**主要機能:**
- グローバルイベントハンドラー設定（window.handleXXXClick関数）
- 5種類のトースト通知システム（success/error/warning/info/loading）
- マップクリックルーティング（乗車モード vs. 目的地モード）
- ローディング状態管理

**通知タイプ:**
```javascript
// 成功通知（3秒で自動消去）
uiService.showNotification('ロボットを配車しました', 'success');

// エラー通知（3秒で自動消去）
uiService.showNotification('操作に失敗しました', 'error');

// ローディング通知（手動消去）
const loadingId = uiService.showNotification('処理中...', 'loading');
uiService.removeNotification(loadingId);
```

---

## 🎨 ユーザーインターフェース

### マップコントロール

**乗車モード**（ロボット未使用時）
1. 地図上の任意の場所をクリック
2. 紫色の"🧍"マーカーが表示
3. "この場所にロボットを呼ぶ"ボタンをクリック
4. システムが最寄りのアイドルロボットを配車

**目的地モード**（ロボット使用中）
1. 希望する目的地を地図上でクリック
2. 緑色の"🏁"マーカーが表示
3. "この場所へ行く"ボタンをクリック
4. ROS2 Nav2が最適経路を計算

### ロボットステータス表示

| ステータス | 日本語表示 | 色 | アイコン |
|-----------|-----------|-----|---------|
| `idle` | アイドリング中 | 青 | 🤖 |
| `in_use` | 使用中 | オレンジ | 🤖 |
| `moving` | 走行中 | 緑 | 🤖 |
| `dispatching` | 配車中 | 紫 | 🤖 |

### センサーダッシュボード

画面右下に配置:

```
┌────────────────────────────────┐
│  🤖 ロボットテレメトリ      [▼] │
├────────────────────────────────┤
│  TurtleBot3-001    [走行中]    │
│                                │
│  🔋 85.5%    ⚡ 0.22 m/s       │
│  ██████████░░░    12.6V        │
│                                │
│  🎯 3.4m      🚧 クリア         │
│                                │
│  最終更新: 14:23:45            │
└────────────────────────────────┘
```

---

## 🔌 Firebase統合

### Firestoreスキーマ

**コレクション: `robots`**

```javascript
{
    id: "robot_001",                    // ロボット識別子
    name: "TurtleBot3-001",             // 表示名
    status: "idle",                     // idle | in_use | moving | dispatching
    position: GeoPoint(36.55077, 139.92957),  // 現在のGPS座標
    heading: 0.0,                       // 方向（ラジアン）
    destination: GeoPoint(36.55080, 139.92960) | null,  // 目標位置
    telemetry: {
        battery_percent: 85.5,
        battery_voltage: 12.6,
        battery_charging: false,
        speed: 0.22,
        distance_to_goal: 3.42,
        obstacle_detected: false,
        min_obstacle_distance: 2.35
    },
    last_updated: Timestamp            // 最終更新時刻
}
```

### リアルタイム同期

Webインターフェースは、リアルタイム更新にFirestoreの`onSnapshot`リスナーを使用:

```javascript
const robotsCol = collection(db, 'robots');
onSnapshot(robotsCol, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
        if (change.type === "modified") {
            const robot = change.doc.data();
            mapService.updateRobotMarker(change.doc.id, robot);
            sensorDashboard.updateRobotSensors(change.doc.id, robot);
        }
    });
});
```

### 書き込み操作

**ロボット配車:**
```javascript
await updateDoc(doc(db, 'robots', robotId), {
    status: 'dispatching',
    destination: new GeoPoint(lat, lng),
    last_updated: new Date().toISOString()
});
```

**目的地設定:**
```javascript
await updateDoc(doc(db, 'robots', robotId), {
    status: 'moving',
    destination: new GeoPoint(lat, lng),
    last_updated: new Date().toISOString()
});
```

**目的地クリア:**
```javascript
await updateDoc(doc(db, 'robots', robotId), {
    destination: deleteField(),
    status: 'idle',
    last_updated: new Date().toISOString()
});
```

---

## ⚙️ 設定

### 環境変数

`.env`を作成するか、コード内で直接設定:

```javascript
// Firebase設定
FIREBASE_API_KEY=your_api_key
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com

// Google Maps設定
GOOGLE_MAPS_API_KEY=your_maps_api_key

// マップ設定
DEFAULT_MAP_CENTER_LAT=36.55077
DEFAULT_MAP_CENTER_LNG=139.92957
DEFAULT_MAP_ZOOM=17
```

### セキュリティルール（Firebase）

**Firestoreルール:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /robots/{robotId} {
      // 認証済みユーザーに読み取りアクセスを許可
      allow read: if request.auth != null;
      
      // 特定フィールドのみ書き込み許可
      allow update: if request.auth != null 
                    && request.resource.data.keys().hasOnly(['status', 'destination', 'last_updated']);
    }
  }
}
```

---

## 🔍 トラブルシューティング

### 地図が読み込まれない

**症状:** 空白画面または"Map failed to load"エラー

**解決策:**
1. `apiKey.js`内のGoogle Maps APIキーを確認
2. APIキーでMaps JavaScript APIが有効化されているか確認
3. ブラウザコンソールでCORSエラーを確認
4. `GOOGLE_API_KEY`変数が正しく設定されているか確認

```javascript
// デバッグスクリプト
console.log('Google API Key:', typeof GOOGLE_API_KEY !== 'undefined');
console.log('Google Maps loaded:', typeof google !== 'undefined');
```

### Firebase接続問題

**症状:** ロボットマーカーが表示されない、リアルタイム更新が機能しない

**解決策:**
1. `js/config/firebase.js`のFirebase設定を確認
2. Firestoreルールで読み取りアクセスが許可されているか確認
3. 匿名認証が有効になっているか確認
4. ブラウザコンソールを開き、Firebaseエラーを確認

```javascript
// Firebase接続テスト
import { db, collection, getDocs } from './js/config/firebase.js';
const snapshot = await getDocs(collection(db, 'robots'));
console.log('Robots found:', snapshot.size);
```

### マーカーが更新されない

**症状:** 地図上でロボット位置が固定

**解決策:**
1. ROS2 Firebase Bridgeが実行中か確認
2. Firestoreコンソールでロボット位置データを確認
3. ブラウザコンソールでJavaScriptエラーを確認
4. ブラウザキャッシュをクリアして再読み込み

```javascript
// マーカー更新デバッグ
window.getMobilityAppStatus();
// 期待される出力:
// {
//   initialized: true,
//   activeMarkers: 3,
//   mapInitialized: true
// }
```

### センサーダッシュボードが表示されない

**症状:** ダッシュボードパネルが欠落または空

**解決策:**
1. Firestoreにテレメトリデータが存在するか確認
2. CSSファイル`dashboard-styles.css`が読み込まれているか確認
3. ブラウザインスペクタを開き、`#sensor-dashboard`要素を探す
4. コンソールでダッシュボード初期化エラーを確認

---

## 🎯 パフォーマンス最適化

### 更新スロットリング

アプリケーションは、不要なレンダリングを減らすインテリジェントなスロットリングを実装:

```javascript
// 位置更新: 1m以上移動した場合のみ
const tolerance = 0.00001; // 約1.1m
if (Math.abs(newLat - oldLat) < tolerance && 
    Math.abs(newLng - oldLng) < tolerance) {
    return; // 更新をスキップ
}

// Firestore更新: ロボットごとに500msに1回まで
if (now - lastUpdate < 500) {
    return; // 更新をスキップ
}
```

### メリット:
- マップ再レンダリングの**90%削減**
- **Firestore読み取り削減**（コスト削減）
- **よりスムーズなアニメーション**（マーカー位置ジャンプの減少）
- モバイルデバイスでの**バッテリー使用量削減**

---

## 📱 モバイル対応

インターフェースは完全にレスポンシブで、モバイルデバイス向けに最適化:

**ビューポート設定:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

**レスポンシブブレークポイント:**
- デスクトップ: フルサイドバー + ダッシュボード
- タブレット（≤768px）: 折りたたみ可能サイドバー
- モバイル（≤480px）: ボトムシートダッシュボード、簡易コントロール

**タッチ最適化:**
- タップターゲット≥44px（Apple HIG準拠）
- ダッシュボード折りたたみ用スワイプジェスチャー
- 地図上でのピンチズーム（ネイティブGoogle Maps）

---

## 🔒 セキュリティ考慮事項

### APIキー制限

**Google Maps API:**
```
HTTPリファラー: https://yourdomain.com/*
API制限: Maps JavaScript APIのみ
```

**Firebase:**
```
Firestoreルール: 認証済みユーザーのみ
匿名サインイン: 有効（レート制限付き）
```

### データプライバシー

- ユーザー位置追跡なし（マーカーはロボットのみを表す）
- 匿名Firebase認証
- 個人データ保存なし
- HTTPS専用デプロイメント推奨

---

## 🚀 デプロイ

### Firebase Hosting

```bash
# Firebase CLIインストール
npm install -g firebase-tools

# Firebaseログイン
firebase login

# プロジェクト初期化
firebase init hosting

# デプロイ
firebase deploy --only hosting
```

### 静的ホスティング（Netlify/Vercel）

```bash
# ビルド設定
# Publicディレクトリ: .
# ビルドコマンド: (なし - 静的ファイル)
# Publishディレクトリ: .
```

### 環境変数

ホスティングプラットフォームで設定:
- `FIREBASE_API_KEY`
- `GOOGLE_MAPS_API_KEY`

---

## 🧪 テスト

### 手動テストチェックリスト

- [ ] 地図がデフォルト位置で正しく読み込まれる
- [ ] ロボットマーカーがリアルタイムで表示・更新される
- [ ] 地図クリックで乗車地点/目的地マーカーが配置される
- [ ] "ロボットを呼ぶ"ボタンで最寄りロボットが配車される
- [ ] "目的地設定"ボタンでロボットステータスが更新される
- [ ] センサーダッシュボードにライブテレメトリが表示される
- [ ] ユーザーアクションに対して通知が表示される
- [ ] ダッシュボードの折りたたみ/展開が機能する
- [ ] モバイルレスポンシブレイアウトが正常に機能する

### ブラウザ互換性

| ブラウザ | バージョン | ステータス |
|---------|-----------|----------|
| Chrome | 90+ | ✅ 完全サポート |
| Firefox | 88+ | ✅ 完全サポート |
| Safari | 14+ | ✅ 完全サポート |
| Edge | 90+ | ✅ 完全サポート |
| Opera | 76+ | ✅ 完全サポート |

---

## 📚 APIリファレンス

### MapServiceメソッド

```javascript
// マップ初期化
mapService.initializeMap(elementId, onClickCallback)

// ロボットマーカー更新
mapService.updateRobotMarker(robotId, robotData)

// 乗車地点マーカー配置
mapService.placePickupMarker(location)

// 目的地マーカー配置
mapService.placeDestinationMarker(location, robotId)

// マーカー削除
mapService.removeMarker(robotId)
```

### RobotServiceメソッド

```javascript
// リアルタイム更新開始
robotService.startRealtimeUpdates()

// ロボットを位置に呼ぶ
await robotService.callRobot(lat, lng)

// 目的地設定
await robotService.setDestination(robotId, lat, lng)

// 乗降アクション処理
await robotService.handleRideAction(robotId, 'ride' | 'getoff')

// 使用中ロボット取得
await robotService.getInUseRobot()
```

### UIServiceメソッド

```javascript
// 通知表示
uiService.showNotification(message, type, duration)

// 通知削除
uiService.removeNotification(notificationId)

// 地図クリック処理
uiService.handleMapClick(location)
```

---

## 🤝 コントリビューション

コントリビューションを歓迎します！以下のガイドラインに従ってください:

1. リポジトリをフォーク
2. 機能ブランチを作成（`git checkout -b feature/amazing-feature`）
3. 既存のコードスタイルに従う（ES6+、JSDocコメント）
4. 複数のブラウザで十分にテスト
5. 変更をコミット（`git commit -m 'Add amazing feature'`）
6. ブランチにプッシュ（`git push origin feature/amazing-feature`）
7. プルリクエストを作成

### コードスタイル

- ES6+機能を使用（アロー関数、分割代入など）
- すべての関数にJSDocコメントを追加
- 意味のある変数名を使用
- モジュラーサービスアーキテクチャに従う
- 可能な限り関数を純粋に保つ

---

## 📄 ライセンス

本プロジェクトはMITライセンスの下でライセンスされています。詳細は[LICENSE](LICENSE)ファイルを参照してください。

---

## 👤 著者

**尾花　優冴（Yugo Obana）**  
宇都宮大学 機械工学科  
専門分野: クラウドロボティクス統合、Webベースフリート管理

### 連絡先
- LinkedIn: [your-profile](www.linkedin.com/in/yugo-dev)
- GitHub: [your-github](https://github.com/Iruazu)

---

## 🙏 謝辞

- **Firebase** - リアルタイムデータベースインフラの提供
- **Google Maps Platform** - マッピングサービスの提供
- **Tailwind CSS** - ユーティリティファーストスタイリング
- **ROS2コミュニティ** - ロボティクスミドルウェア統合

---

## 📧 サポート

質問や問題がある場合:
- [Issue](https://github.com/Iruazu/mobility-map-app/issues)を開く
- メール: ygnk0805@outlook.jp

---

**自律モビリティとリアルタイムフリート管理のために ❤️ を込めて開発**