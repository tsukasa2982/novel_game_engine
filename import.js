const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// ★★★ 1. 自分のプロジェクトの「サービスアカウント秘密鍵」をダウンロードし、
// このファイルと同じ階層に `serviceAccountKey.json` という名前で保存してください。
const serviceAccount = require('./serviceAccountKey.json');

// ★★★ 2. 登録先のテナントIDを指定
const TENANT_ID = 'dropshipping';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// --- 1. キャラクターデータのインポート ---
const importCharacters = async () => {
  console.log('--- キャラクターデータのインポート開始 ---');
  const characterData = JSON.parse(fs.readFileSync(path.join(__dirname, 'characters.json'), 'utf8'));
  const batch = db.batch();
  
  const collectionRef = db.collection('tenants').doc(TENANT_ID).collection('characters');
  
  characterData.forEach((char, index) => {
    // ドキュメントIDを「characterId_expressionId」で作成
    const docId = `${char.characterId}_${char.expressionId}`;
    const docRef = collectionRef.doc(docId);
    batch.set(docRef, char);
    console.log(`[${index+1}/${characterData.length}] characters/${docId} をバッチに追加`);
  });
  
  await batch.commit();
  console.log(`✅ ${characterData.length} 件のキャラクターデータをインポート完了。`);
};

// --- 2. シナリオデータのインポート ---
const importScenario = async () => {
  console.log('\n--- シナリオデータのインポート開始 ---');
  const scenarioData = JSON.parse(fs.readFileSync(path.join(__dirname, 'scenario.json'), 'utf8'));
  const batch = db.batch();
  
  const collectionRef = db.collection('tenants').doc(TENANT_ID).collection('scenario');
  
  scenarioData.forEach((line) => {
    // ドキュメントIDを `order` 番号 (0埋め) で作成 (例: 001, 002, ... 705)
    const docId = String(line.order).padStart(5, '0');
    const docRef = collectionRef.doc(docId);
    batch.set(docRef, line);
    console.log(`[${line.order}/${scenarioData.length}] scenario/${docId} をバッチに追加`);
  });
  
  await batch.commit();
  console.log(`✅ ${scenarioData.length} 件のシナリオデータをインポート完了。`);
};

// --- 実行 ---
const main = async () => {
  try {
    await importCharacters();
    await importScenario();
    console.log('\n🎉 すべてのデータのインポートが完了しました。');
  } catch (error) {
    console.error('インポート中にエラーが発生しました:', error);
  }
};

main();