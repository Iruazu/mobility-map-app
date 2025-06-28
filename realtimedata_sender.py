# realtimedata_sender.py
# ROSやRTKLIBからTCP/IPでストリーミングされるGPSデータを受信し、Firebaseに送信するスクリプト

import socket
import time
import firebase_admin
from firebase_admin import credentials, firestore

# --- 1. 初期設定 ---
# Firebaseの初期化 (サービスアカウントキーのパスは要確認)
cred = credentials.Certificate('serviceAccountKey.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

# 更新対象のロボットのドキュメントID (Firebaseコンソールで確認)
ROBOT_DOCUMENT_ID = 'FA39JNoNKqKKNbFuGQYg'
robot_ref = db.collection('robots').document(ROBOT_DOCUMENT_ID)

# 接続するTCPサーバーの情報 (ROS/RTKLIB側で設定したもの)
HOST = 'localhost'  # 同じPC内で動かすのでlocalhost
PORT = 9999         # ROS/RTKLIBがデータをストリーミングしているポート

print(f"ロボット {ROBOT_DOCUMENT_ID} のデータ送信を開始します。")
print(f"TCPサーバー {HOST}:{PORT} に接続します...")

# --- 2. メイン処理 ---
def main():
    while True:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.connect((HOST, PORT))
                print("サーバーに接続しました。データ受信待機中...")
                
                # データを受信し続けるためのバッファ
                buffer = ""
                while True:
                    # 4096バイトずつデータを受信
                    data = s.recv(4096).decode('utf-8', errors='ignore')
                    if not data:
                        break # 接続が切れたらループを抜ける
                    
                    buffer += data
                    
                    # 受信データに改行が含まれていれば、行ごとに処理
                    while '\n' in buffer:
                        line, buffer = buffer.split('\n', 1)
                        line = line.strip()
                        
                        # NMEAのGPGGAセンテンスかチェック
                        if line.startswith('$GPGGA'):
                            parse_and_send_gpgga(line)

        except ConnectionRefusedError:
            print(f"接続が拒否されました。サーバーが起動しているか確認してください。5秒後に再試行します...")
            time.sleep(5)
        except Exception as e:
            print(f"エラーが発生しました: {e}。5秒後に再接続を試みます...")
            time.sleep(5)

# GPGGAセンテンスをパースしてFirestoreに送信する関数
def parse_and_send_gpgga(line):
    parts = line.split(',')
    
    # 緯度と経度が有効なデータか確認
    if len(parts) > 4 and parts[2] and parts[4]:
        try:
            # NMEAフォーマット(dddmm.mmmm)から度(degree)へ変換
            lat_raw = float(parts[2])
            lat_deg = int(lat_raw / 100)
            lat_min = lat_raw - (lat_deg * 100)
            lat = lat_deg + (lat_min / 60)
            if parts[3] == 'S':
                lat = -lat

            lng_raw = float(parts[4])
            lng_deg = int(lng_raw / 100)
            lng_min = lng_raw - (lng_deg * 100)
            lng = lng_deg + (lng_min / 60)
            if parts[5] == 'W':
                lng = -lng
            
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

        except (ValueError, IndexError) as e:
            print(f"NMEAデータのパース中にエラー: {e}, line: {line}")


if __name__ == '__main__':
    main()
