# realtimedata_sender.py
# ROS (rosbridge)からTCP/IPでストリーミングされるGPSデータを受信し、Firebaseに送信するスクリプト

import socket
import time
import json
import firebase_admin
from firebase_admin import credentials, firestore

# --- 1. 初期設定 ---
# Firebaseの初期化
cred = credentials.Certificate('serviceAccountKey.json') 
firebase_admin.initialize_app(cred)
db = firestore.client()

# 更新対象のロボットのドキュメントID (Firebaseコンソールで確認)
ROBOT_DOCUMENT_ID = 'ここに実機ロボットのドキュメントIDを貼り付け'

# ROSから配信されるGPSデータのトピック名 (rostopic listで要確認)
TOPIC_NAME = '/navsat/fix' # 例: '/gps/fix' など、実際のトピック名に書き換える

# 接続するrosbridgeの情報
HOST = 'localhost'  # 同じPC内で動かすのでlocalhost
PORT = 9090         # rosbridge_tcpのデフォルトポート

robot_ref = db.collection('robots').document(ROBOT_DOCUMENT_ID)
print(f"ロボット {ROBOT_DOCUMENT_ID} のデータ送信を開始します。")
print(f"rosbridge ({HOST}:{PORT}) に接続します...")

# --- 2. メイン処理 ---
def main():
    while True:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.connect((HOST, PORT))
                print("rosbridgeに接続しました。")
                
                # 監視したいトピックを購読する命令をrosbridgeに送信
                subscribe_message = {
                    "op": "subscribe",
                    "topic": TOPIC_NAME
                }
                s.sendall((json.dumps(subscribe_message) + '\n').encode('utf-8'))
                print(f"トピック '{TOPIC_NAME}' の購読を開始しました。データ受信待機中...")

                buffer = ""
                while True:
                    data = s.recv(4096).decode('utf-8', errors='ignore')
                    if not data:
                        break
                    
                    # rosbridgeからはJSONが複数くっついてくることがあるので、正しく分割する
                    buffer += data
                    while buffer:
                        try:
                            # 最初のJSONオブジェクトをパース試行
                            msg, index = json.JSONDecoder().raw_decode(buffer)
                            buffer = buffer[index:].lstrip() # 処理した部分と空白を削除

                            # 受け取ったメッセージが目的のトピックのデータか確認
                            if msg.get('op') == 'publish' and msg.get('topic') == TOPIC_NAME:
                                parse_and_send_navsatfix(msg['msg'])

                        except json.JSONDecodeError:
                            # JSONとして不完全な場合は、次のデータ受信を待つ
                            break

        except ConnectionRefusedError:
            print(f"接続が拒否されました。rosbridgeが起動しているか確認してください。5秒後に再試行します...")
            time.sleep(5)
        except Exception as e:
            print(f"エラーが発生しました: {e}。5秒後に再接続を試みます...")
            time.sleep(5)

# sensor_msgs/NavSatFix 形式のメッセージをパースしてFirestoreに送信する関数
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
        print(f"受信したメッセージの形式が不正です: {e}, msg: {msg}")


if __name__ == '__main__':
    main()
