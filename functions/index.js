const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// (generateSaveCode... は変更なし)
function generateSaveCode(length = 8) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}


/**
 * ★★★ v10 (Gen2 互換対応版) ★★★
 * API to get scenario data for a specific tenant.
 */
exports.getScenario = functions.https.onCall(async (data, context) => {
  
  console.log("--- getScenario (v10) が呼び出されました ---");

  // ★★★【Gen2互換修正】 Gen1 on Gen2環境では、ペイロードは data.data に格納される ★★★
  const payload = data.data || data; // data.data が存在すればそれ
  
  // ★★★【修正】ペイロードから値を取り出す ★★★
  const { tenantId, scenarioName } = payload;
  
  if (!tenantId || !scenarioName) {
      // (JSON.stringifyは安全のため削除)
      console.error("Validation failed! (getScenario)");
      throw new functions.https.HttpsError("invalid-argument", "tenantId and scenarioName are required.");
  }

  // (↓ここから下は変更なし)
  const snapshot = await db.collection("tenants").doc(tenantId).collection("scenario").get();
  
  if (snapshot.empty) {
    return { scenario: [] };
  }

  const scenario = [];
  snapshot.forEach(doc => {
    scenario.push(doc.data());
  });

  return { scenario: scenario };
});

/**
 * ★★★ v10 (Gen2 互換対応版) ★★★
 * API to get character definitions for a specific tenant.
 */
exports.getCharacters = functions.https.onCall(async (data, context) => {
  
  console.log("--- getCharacters (v10) が呼び出されました ---");

  // ★★★【Gen2互換修正】 Gen1 on Gen2環境では、ペイロードは data.data に格納される ★★★
  const payload = data.data || data; // data.data が存在すればそれ

  // ★★★【修正】ペイロードから値を取り出す ★★★
  const { tenantId } = payload;
  
  if (!tenantId) {
    // (JSON.stringifyは安全のため削除)
    console.error("Validation failed! (getCharacters)");
    throw new functions.https.HttpsError("invalid-argument", "tenantId is required.");
  }

  // (↓ここから下は変更なし)
  const snapshot = await db.collection("tenants").doc(tenantId).collection("characters").get();

  if (snapshot.empty) {
    return { characters: [] };
  }

  const characters = [];
  snapshot.forEach(doc => {
    characters.push(doc.data());
  });

  return { characters: characters };
});


/**
 * API to save game progress. (★ v10 互換対応)
 */
exports.saveGame = functions.https.onCall(async (data, context) => {
    // ★★★【Gen2互換修正】★★★
    const payload = data.data || data;
    const { tenantId, saveData } = payload;
    
    if (!tenantId || !saveData) {
        throw new functions.https.HttpsError("invalid-argument", "tenantId and saveData are required.");
    }
    
    const saveCode = generateSaveCode();
    
    await db.collection("tenants").doc(tenantId).collection("saveData").doc(saveCode).set({
        ...saveData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    return { saveCode: saveCode };
  });

/**
 * API to load game progress from a save code. (★ v10 互換対応)
 */
exports.loadGame = functions.https.onCall(async (data, context) => {
    // ★★★【Gen2互換修正】★★★
    const payload = data.data || data;
    const { tenantId, saveCode } = payload;
    
    if (!tenantId || !saveCode) {
        throw new functions.https.HttpsError("invalid-argument", "tenantId and saveCode are required.");
    }

    const docRef = db.collection("tenants").doc(tenantId).collection("saveData").doc(saveCode);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Save data not found.");
    }
    
    return { saveData: docSnap.data() };
  });