// Firebase SDKから必要な関数をインポート
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, updateDoc, getDoc, getDocs, GeoPoint, deleteField } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// ウェブアプリのFirebase設定
const firebaseConfig = {
    apiKey: "AIzaSyDW1WMrrgv-pg0lJwgR3G__R4xxtnQpevY",
    authDomain: "mobility-map-ae58e.firebaseapp.com",
    projectId: "mobility-map-ae58e",
    storageBucket: "mobility-map-ae58e.appspot.com",
    messagingSenderId: "714590381625",
    appId: "1:714590381625:web:fea8e2f819cba4a243cfe8",
    measurementId: "G-PQ21YKP1VP"
};

// Firebaseを初期化
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Firebase関連の関数をエクスポート
export { 
    collection, 
    onSnapshot, 
    doc, 
    updateDoc, 
    getDoc, 
    getDocs, 
    GeoPoint, 
    deleteField,
    signInAnonymously,
    onAuthStateChanged
};

/**
 * Firebase認証を初期化する関数
 * @param {Function} onAuthSuccess - 認証成功時のコールバック
 */
export function initializeAuth(onAuthSuccess) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("匿名認証に成功しました。UserID:", user.uid);
            onAuthSuccess();
        } else {
            signInAnonymously(auth).catch((error) => {
                console.error("匿名サインインエラー:", error);
                alert("認証に失敗しました。ページを再読み込みしてください。");
            });
        }
    });
}