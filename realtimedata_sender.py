# realtimedata_sender.py
# rostopic echoからの標準出力を受け取り、Firebaseに送信するスクリプト

import sys
import yaml # ROSトピックの出力(YAML形式)をパースするために使用
import firebase_admin
from firebase_admin import credentials, firestore

# --- 1. 初期設定 ---
# Firebaseの初期化
cred = credentials.Certificate('serviceAccountKey.json') 
firebase_admin.initialize_app(cred)
db = firestore.client()

# 更新対象のロボットのドキュメントID (Firebaseコンソールで確認)
ROBOT_DOCUMENT_ID = 'ここに実機ロボットのドキュメントIDを貼り付け'

robot_ref = db.collection('robots').document(ROBOT_DOCUMENT_ID)
print(f"ロボット {ROBOT_DOCUMENT_ID} のデータ送信を開始します。")
print(f"rostopicからのデータ入力を待機中...")

# --- 2. メイン処理 ---
def main():
    try:
        # rostopic echoの出力は '---' で区切られる
        # その区切りごとの塊を一つのメッセージとして処理する
        message_buffer = []
        for line in sys.stdin:
            if line.strip() == '---':
                # メッセージの区切りが来たので、バッファを処理
                full_message = "".join(message_buffer)
                message_buffer = [] # バッファをリセット
                
                try:
                    # YAMLとしてパース
                    data = yaml.safe_load(full_message)
                    parse_and_send_navsatfix(data)
                except yaml.YAMLError as e:
                    print(f"YAMLのパースに失敗しました: {e}")

            else:
                message_buffer.append(line)

    except KeyboardInterrupt:
        print("\nスクリプトを終了します。")
    except Exception as e:
        print(f"予期せぬエラーが発生しました: {e}")

# sensor_msgs/NavSatFix 形式のメッセージ(辞書型)をパースしてFirestoreに送信する関数
def parse_and_send_navsatfix(msg):
    try:
        # メッセージから緯度と経度を抽出
        lat = msg['latitude']
        lng = msg['longitude']
        
        # FirestoreのGeoPoint形式にデータを変換
        new_position = firestore.GeoPoint(lat, lng)

        # 送信するデータを作成
        update_data = {
            'position': new_position,
            'status': '走行中' # 常に走行中として更新する例
        }

        # Firestoreのデータを更新
        robot_ref.update(update_data)
        print(f"位置情報更新: Lat {lat:.6f}, Lng {lng:.6f}")

    except (KeyError, TypeError) as e:
        print(f"受信したメッセージの形式が不正か、必要なキーが含まれていません: {e}")


if __name__ == '__main__':
    main()
