/**
 * app.js v24 - 厚め記述・機能完全版
 * * 修正ポイント:
 * 1. v20のロジック構造を維持（行数を確保し、処理を明文化）
 * 2. dropshipping_process.png 等のStorage画像解決を強化
 * 3. ロード時の立ち絵・背景の消滅問題を解決
 */

console.log("--- app.js v24 (Robust Version) ロード開始 ---");

// --- Firebase の存在確認 ---
if (typeof firebase === "undefined") {
    console.error("Firebase SDKが読み込まれていません。");
    alert("初期化エラー: Firebase SDKが見つかりません。");
}

// --- 設定: アセット（画像）の解決ロジック ---
const ASSET_RESOLVER = {
    // スクリーンショットに基づいたバケットURL
    bucketBase: "https://firebasestorage.googleapis.com/v0/b/novel-game-engine.firebasestorage.app/o/",

    // 背景画像URLの生成
    resolveBgUrl: function(id) {
        if (!id) return "";
        // 既存のGitHub URL等はそのまま返す
        if (id.startsWith('http')) return id;
        // 名前だけの場合は Storage の backgrounds/ 名前.png を返す
        const fullPath = "backgrounds/" + id + ".png";
        return this.bucketBase + encodeURIComponent(fullPath) + "?alt=media";
    },

    // キャラクター画像URLの生成
    resolveCharUrl: function(charId, expressionId) {
        // IDが narrator の場合は画像なし
        if (charId === 'narrator') return "";
        // 名前だけの場合は Storage の characters/ 名前.png を参照
        const fullPath = "characters/" + charId + ".png";
        return this.bucketBase + encodeURIComponent(fullPath) + "?alt=media";
    }
};

async function mainGameInit() {
    // サービスの初期化
    const app = firebase.app();
    const functions = app.functions('us-central1');
    
    // Cloud Functions 呼び出しの共通化
    const callApi = async (name, data) => {
        const callable = functions.httpsCallable(name);
        const result = await callable(data);
        return result.data;
    };

    let scenario = [];
    let characters = {};
    let currentLine = 0;
    let playerName = "";
    let TENANT_ID = "dropshipping";

    // DOM要素の定義（v20準拠）
    const el = {
        loading: document.getElementById('loading-overlay'),
        titleScreen: document.getElementById('title-screen'),
        gameContainer: document.getElementById('game-container'),
        dialogueBox: document.getElementById('dialogue-box'),
        dialogueText: document.getElementById('dialogue-text'),
        characterNameBox: document.getElementById('character-name-box'),
        characterContainer: document.getElementById('character-container'),
        imageOverlay: document.getElementById('image-overlay'),
        overlayImage: document.getElementById('overlay-image'),
        startNewBtn: document.getElementById('start-new-button'),
        loadGameBtn: document.getElementById('load-game-button'),
        nameInputContainer: document.getElementById('name-input-container'),
        loadInputContainer: document.getElementById('load-input-container'),
        playerNameInput: document.getElementById('player-name-input'),
        saveCodeInput: document.getElementById('save-code-input'),
        confirmNameBtn: document.getElementById('confirm-name-button'),
        confirmLoadBtn: document.getElementById('confirm-load-button'),
        uiButtons: document.getElementById('ui-buttons'),
        saveBtn: document.getElementById('save-button'),
    };

    function showSpinner(text) {
        if (el.loading) { el.loading.textContent = text; el.loading.style.display = 'flex'; }
    }

    function hideSpinner() {
        if (el.loading) el.loading.style.display = 'none';
    }

    // --- ロード時に「それまでの背景とキャラ」を再現する重要な関数 ---
    function rebuildStage(targetIndex) {
        console.log("セーブデータから舞台を再構築中... 行数:", targetIndex);
        for (let i = 0; i < targetIndex; i++) {
            const line = scenario[i];
            const [cmd, p1, p2, p3] = [line.command, line.param1, line.param2, line.param3];

            if (cmd === 'bg_change') {
                el.gameContainer.style.backgroundImage = `url(${ASSET_RESOLVER.resolveBgUrl(p1)})`;
            } else if (cmd === 'char_show') {
                updateCharacterImage(p1, p2, p3);
            } else if (cmd === 'char_hide') {
                const target = document.getElementById(`char_${p1}`);
                if (target) target.remove();
            }
        }
    }

    // キャラクター表示の共通処理
    function updateCharacterImage(charId, expressionId, position) {
        let charEl = document.getElementById(`char_${charId}`);
        if (!charEl) {
            charEl = document.createElement('img');
            charEl.id = `char_${charId}`;
            charEl.className = 'character';
            el.characterContainer.appendChild(charEl);
        }
        // FirestoreにURLがあれば優先、なければStorageを参照
        const url = (characters[charId] && characters[charId].expressions[expressionId]) 
                    ? characters[charId].expressions[expressionId] 
                    : ASSET_RESOLVER.resolveCharUrl(charId, expressionId);
        
        charEl.src = url;
        charEl.className = `character pos-${position || 'center'}`;
    }

    async function init() {
        showSpinner('最新のシナリオを読み込んでいます...');
        try {
            const [scenResult, charResult] = await Promise.all([
                callApi('getScenario', { tenantId: TENANT_ID, scenarioName: 'main' }),
                callApi('getCharacters', { tenantId: TENANT_ID })
            ]);

            scenario = scenResult.scenario.sort((a, b) => (a.order || 0) - (b.order || 0));
            charResult.characters.forEach(c => {
                if (!characters[c.characterId]) {
                    characters[c.characterId] = { name: c.characterName, expressions: {} };
                }
                characters[c.characterId].expressions[c.expressionId] = c.imageUrl;
            });
            hideSpinner();
        } catch (e) { console.error(e); hideSpinner(); }
    }

    function startGame() {
        el.titleScreen.style.display = 'none';
        el.dialogueBox.style.display = 'block';
        el.uiButtons.style.display = 'block';
        
        // セーブデータからの再開なら舞台を再現
        if (currentLine > 0) rebuildStage(currentLine);
        
        processLine();
    }

    function processLine() {
        if (currentLine >= scenario.length) { alert("物語は幕を閉じました。"); return; }
        
        const line = scenario[currentLine];
        const { command, param1, param2, param3 } = line;

        console.log(`実行中: 行 ${currentLine} 命令 ${command}`);

        switch (command) {
            case 'text':
                const charData = characters[param1] || { name: param1 };
                el.characterNameBox.textContent = (param1 === 'narrator') ? '' : charData.name.replace('%PLAYER_NAME%', playerName);
                el.dialogueText.innerHTML = param2.replace('%PLAYER_NAME%', playerName);
                
                // 他のキャラを暗くする演出
                document.querySelectorAll('.character').forEach(c => c.classList.add('inactive'));
                const active = document.getElementById(`char_${param1}`);
                if (active) active.classList.remove('inactive');
                
                currentLine++;
                break;

            case 'char_show':
                updateCharacterImage(param1, param2, param3);
                currentLine++;
                processLine();
                break;

            case 'char_hide':
                const target = document.getElementById(`char_${param1}`);
                if (target) target.remove();
                currentLine++;
                processLine();
                break;

            case 'bg_change':
                // ファイル名からURLを取得して背景セット
                const bgUrl = ASSET_RESOLVER.resolveBgUrl(param1);
                el.gameContainer.style.backgroundImage = `url(${bgUrl})`;
                currentLine++;
                processLine();
                break;

            case 'img_show':
                el.overlayImage.src = ASSET_RESOLVER.resolveBgUrl(param1);
                el.imageOverlay.style.display = 'flex';
                currentLine++;
                break;

            case 'img_hide':
                el.imageOverlay.style.display = 'none';
                currentLine++;
                processLine();
                break;

            default:
                currentLine++;
                processLine();
                break;
        }
    }

    // --- セーブ・ロード処理 (v20の丁寧な記述を維持) ---
    async function handleSave() {
        showSpinner('データを保存中...');
        try {
            const result = await callApi('saveGame', { tenantId: TENANT_ID, saveData: { playerName, currentLine } });
            hideSpinner();
            
            const content = `【セーブデータ】\nコード: ${result.saveCode}\n次回の再開時に使用してください。`;
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `save_${TENANT_ID}.txt`;
            a.click();

            const modal = document.getElementById('save-modal');
            if (modal) modal.style.display = 'flex';
            else alert("セーブ完了しました。");
        } catch (err) { hideSpinner(); alert("セーブ失敗: " + err.message); }
    }

    async function handleLoad(code) {
        showSpinner('データを読み込んでいます...');
        try {
            const result = await callApi('loadGame', { tenantId: TENANT_ID, saveCode: code });
            const sd = result.saveData;
            if (sd) {
                playerName = sd.playerName;
                currentLine = sd.currentLine;
                hideSpinner();
                startGame();
            }
        } catch (e) { hideSpinner(); alert("データが見つかりませんでした。"); }
    }

    // イベント登録
    el.dialogueBox.onclick = () => { if(el.dialogueBox.style.display !== 'none') processLine(); };
    el.startNewBtn.onclick = () => { el.startNewBtn.style.display = 'none'; el.loadGameBtn.style.display = 'none'; el.nameInputContainer.style.display = 'block'; };
    el.confirmNameBtn.onclick = () => { playerName = el.playerNameInput.value.trim(); if(playerName) startGame(); };
    el.loadGameBtn.onclick = () => { el.startNewBtn.style.display = 'none'; el.loadGameBtn.style.display = 'none'; el.loadInputContainer.style.display = 'block'; };
    el.confirmLoadBtn.onclick = () => { const c = el.saveCodeInput.value.trim(); if(c) handleLoad(c); };
    el.saveBtn.onclick = handleSave;

    init();
}

mainGameInit().catch(console.error);