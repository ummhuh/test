let profitChartInstance = null;
let currentAnalysis = null; 
let currentAnswer = null; 
let lastQuestionType = "";
let justSmartAdjusted = false; 
let isEnvLocked = false; 

const strategyConfigs = {
    ShortPut: { 
        name: "Short Put", desc: "策略偏多，適合預期股價持平或溫和上漲。", 
        rules: ["履約價 (K)：K1 < S0 (必須在現價之下，嚴格要求在價外 OTM 建倉)", "建倉性質：收取淨權利金 (Net Credit > 0)"],
        adjustHint: "已幫您退到 1 SD 的價外。若在真實市場中這樣收不到錢，請嘗試拉長到期天數 (DTE)。",
        legs: [{id:'K1',label:'Short Put K1'},{id:'P1',label:'P1'}],
        greekGuide: `<div style="margin-bottom: 15px;"><h4 style="color: #0099ff; margin-bottom: 5px;">📊 總體希臘字母特性</h4><p>Delta: 正 (+) | Theta: 正 (+) | Vega: 負 (-)<br>時間是你的朋友，但極度害怕隱含波動率突然飆升。</p></div><div style="margin-bottom: 15px;"><h4 style="color: #0099ff; margin-bottom: 5px;">🎯 履約價挑選指南</h4><ul style="padding-left: 20px;"><li style="margin-bottom: 5px;">Short Put (K1): 建議挑選 Delta -0.15 ~ -0.30 的價外合約。</li></ul></div><div><h4 style="color: #0099ff; margin-bottom: 5px;">💡 實戰眉角</h4><p>建議挑選 DTE 30~45 天的合約，若在 IV Rank > 50% 時建倉更佳。</p></div>`
    },
    BullPutSpread: { 
        name: "Bull Put Spread", desc: "策略偏多，適合預期股價持平或溫和上漲。", 
        rules: ["履約價 (K)：K1 < K2 < S0 (買保險的 K1 低於收租的 K2，兩腳皆在價外)", "權利金 (P)：P1 < P2 (越遠價外的 Put 越便宜)", "建倉性質：淨收入 (Net Credit = P2 - P1 > 0)"],
        adjustHint: "已將賣出腳往下推離現價。若變成要付錢 (Debit)，請把買保險的那隻腳 (K1) 拉得更遠，來拓寬價差以獲得 Credit。",
        legs: [{id:'K1',label:'Long Put K1'},{id:'P1',label:'P1'},{id:'K2',label:'Short Put K2'},{id:'P2',label:'P2'}],
        greekGuide: `<div style="margin-bottom: 15px;"><h4 style="color: #0099ff; margin-bottom: 5px;">📊 總體希臘字母特性</h4><p>Delta: 正 (+) | Theta: 正 (+) | Vega: 負 (-)<br>由於買入保險腿抵銷了部分風險，Vega 與 Gamma 的衝擊較單腿 Short Put 小得多。</p></div><div style="margin-bottom: 15px;"><h4 style="color: #0099ff; margin-bottom: 5px;">🎯 履約價挑選指南</h4><ul style="padding-left: 20px;"><li style="margin-bottom: 5px;">Short Put (K2): 作為主要獲利來源，建議挑選 Delta -0.20 ~ -0.30 的履約價。</li><li style="margin-bottom: 5px;">Long Put (K1): 作為防護腳，挑選 Delta -0.05 ~ -0.10 的合約。</li></ul></div><div><h4 style="color: #0099ff; margin-bottom: 5px;">💡 實戰眉角</h4><p>實戰中應設定總保費的 2 倍作為停損點，避免一次大跌吃掉數次獲利。</p></div>`
    },
    PutRatioSpreadBull: { 
        name: "Put Ratio Spread", desc: "策略偏多，具備強大下檔防護墊，適合預期股價微跌或持平。", 
        rules: ["履約價 (K)：K2 < K1 <= S0 (買入腳 K1 接近現價，賣出兩口腳 K2 於更深價外)", "權利金 (P)：P2 < P1 (遠價外 P2 較便宜)", "建倉性質：必須達成零成本或淨收入，且確保最大虧損不可為 0。"],
        adjustHint: "已確保 K1 在現價之下 (OTM)，並將 K2 推離安全區，以確保上行空間達到零成本無風險狀態。",
        legs: [{id:'K1',label:'Long Put K1'},{id:'P1',label:'P1'},{id:'K2',label:'Short Put K2 (x 2)'},{id:'P2',label:'P2'}],
        greekGuide: `<div style="margin-bottom: 15px;"><h4 style="color: #0099ff; margin-bottom: 5px;">📊 總體希臘字母特性</h4><p>Delta: 正 (+) | Theta: 正 (+) | Vega: 偏負 (-)<br>擁有獨特的「防護墊」設計，初期對小幅下跌免疫。</p></div><div style="margin-bottom: 15px;"><h4 style="color: #0099ff; margin-bottom: 5px;">🎯 履約價挑選指南</h4><ul style="padding-left: 20px;"><li style="margin-bottom: 5px;">Long Put (K1): 買入較接近現價的保險，建議挑選 Delta -0.40 ~ -0.50。</li><li style="margin-bottom: 5px;">Short Put (K2 x2): 賣出較價外的合約，建議挑選 Delta -0.15 ~ -0.25。</li></ul></div><div><h4 style="color: #0099ff; margin-bottom: 5px;">💡 實戰眉角</h4><p>只要建倉能達成 Zero Cost 或 Net Credit，此策略在上漲時將處於無敵狀態。但請注意下行風險無限，需具備接股意願才可使用。</p></div>`
    },
    PutBWBBull: { 
        name: "Put BWB (Bull)", desc: "策略偏多，屬於進階不對稱保險，下行伴隨較大風險，適合預期股價持平或溫和上漲。", 
        rules: ["履約價 (K)：K1 < K2 < K3 <= S0 (全數價外建倉)", "翅膀邏輯：(K2 - K1) > (K3 - K2) (左翼大於右翼)", "建倉性質：必須為淨收入 (Net Credit > 0)，且確保防套利。"],
        adjustHint: "已確保左側價差大於右側，並將參數推離至安全區，擠出上漲無風險的淨收入 (Net Credit)。",
        legs: [{id:'K1',label:'Long Put K1'},{id:'P1',label:'P1'},{id:'K2',label:'Short Put K2 (x 2)'},{id:'P2',label:'P2'},{id:'K3',label:'Long Put K3'},{id:'P3',label:'P3'}],
        greekGuide: `<div style="margin-bottom: 15px;"><h4 style="color: #0099ff; margin-bottom: 5px;">📊 總體希臘字母特性</h4><p>Delta: 偏正 (+) | Theta: 正 (+) | Vega: 負 (-)<br>這是一個「斷翼」的蝴蝶，透過承擔較大的單邊尾部風險，換取建倉時的淨收入。</p></div><div style="margin-bottom: 15px;"><h4 style="color: #0099ff; margin-bottom: 5px;">🎯 履約價挑選指南</h4><ul style="padding-left: 20px;"><li style="margin-bottom: 5px;">Short Put (K2 x2): 設定在預期股價「跌不破」的支撐位，通常 Delta -0.25 ~ -0.35。</li><li style="margin-bottom: 5px;">Long Put (K3): 買入較接近現價的保險，Delta -0.45 ~ -0.50。</li><li style="margin-bottom: 5px;">Long Put (K1): 斷翼防守腳，買入深價外超便宜合約，Delta -0.05 ~ -0.10。</li></ul></div><div><h4 style="color: #0099ff; margin-bottom: 5px;">💡 實戰眉角</h4><p>確保 K2-K1 的寬距 > K3-K2 的寬距，並透過此差異擠出 Net Credit。只要建倉有淨收入，股價不論暴漲多少你都是賺錢的。</p></div>`
    },
    BullCallSpread: { 
        name: "Bull Call Spread", desc: "策略偏多，適合預期股價將上漲並突破高履約價。", 
        rules: ["履約價 (K)：S0 <= K1 < K2 (兩腳皆在現價之上，價外建倉)", "權利金 (P)：P1 > P2 (低履約價的 Call 一定比較貴)", "建倉性質：Net Debit = P1 - P2 > 0"],
        adjustHint: "買方策略需真實方向移動。已調整買入腳 (K1) 在現價之上 (OTM)，賣出腳 (K2) 作為合理的停利點。",
        legs: [{id:'K1',label:'Long Call K1'},{id:'P1',label:'P1'},{id:'K2',label:'Short Call K2'},{id:'P2',label:'P2'}],
        greekGuide: `<div style="margin-bottom: 15px;"><h4 style="color: #0099ff; margin-bottom: 5px;">📊 總體希臘字母特性</h4><p>Delta: 正 (+) | Theta: 負 (-) | Vega: 正 (+)<br>由於是 Debit 策略，時間流逝對你是不利的，你必須仰賴股價真實上漲來獲利。</p></div><div style="margin-bottom: 15px;"><h4 style="color: #0099ff; margin-bottom: 5px;">🎯 履約價挑選指南</h4><ul style="padding-left: 20px;"><li style="margin-bottom: 5px;">Long Call (K1): 建議買入微價外或平值合約，Delta +0.40 ~ +0.60 之間。</li><li style="margin-bottom: 5px;">Short Call (K2): 賣出價外合約以補貼成本，建議挑選 Delta +0.20 ~ +0.30。</li></ul></div><div><h4 style="color: #0099ff; margin-bottom: 5px;">💡 實戰眉角</h4><p>適合在標的出現強烈看漲訊號時使用。因為帶有負 Theta，盡量不要挑選 DTE 太短 (小於14天) 的合約以免時間價值崩塌。</p></div>`
    },
    BearCallSpread: { 
        name: "Bear Call Spread", desc: "策略偏空，適合預期股價持平或溫和下跌。", 
        rules: ["履約價 (K)：S0 < K1 < K2 (收租的 K1 嚴格在現價之上，保險的 K2 更遠，兩腳皆在價外)", "權利金 (P)：P1 > P2 (靠近現價的 Call 比較貴)", "建倉性質：Net Credit = P1 - P2 > 0"],
        adjustHint: "已將賣出腳往上推離現價。若變成 Debit，請把保險腳 (K2) 拉更遠以獲得 Credit。",
        legs: [{id:'K1',label:'Short Call K1'},{id:'P1',label:'P1'},{id:'K2',label:'Long Call K2'},{id:'P2',label:'P2'}],
        greekGuide: `<div style="margin-bottom: 15px;"><h4 style="color: #0099ff; margin-bottom: 5px;">📊 總體希臘字母特性</h4><p>Delta: 負 (-) | Theta: 正 (+) | Vega: 負 (-)<br>這是一個「只要不漲過壓力線就贏」策略，時間站在你這邊。</p></div><div style="margin-bottom: 15px;"><h4 style="color: #0099ff; margin-bottom: 5px;">🎯 履約價挑選指南</h4><ul style="padding-left: 20px;"><li style="margin-bottom: 5px;">Short Call (K1): 建議設定在強大的壓力位上方，通常挑選 Delta +0.15 ~ +0.30 的價外合約。</li><li style="margin-bottom: 5px;">Long Call (K2): 作為防護腳，挑選 Delta +0.05 ~ +0.10 的合約。</li></ul></div><div><h4 style="color: #0099ff; margin-bottom: 5px;">💡 實戰眉角</h4><p>最適合預期股價遇壓不過、緩慢下跌或橫盤整理的盤勢。由於 Call 端的隱含波動率通常較低，收到的權利金可能不如 Bull Put 豐厚。</p></div>`
    },
    BearPutSpread: { 
        name: "Bear Put Spread", desc: "策略偏空，適合預期股價將下跌並跌破低履約價。", 
        rules: ["履約價 (K)：K1 < K2 <= S0 (買入的 K2 在現價附近，停利的 K1 在更下方，兩腳皆在價外)", "權利金 (P)：P1 < P2 (高履約價的 Put 一定比較貴)", "建倉性質：Net Debit = P2 - P1 > 0"],
        adjustHint: "買方策略需真實方向移動。已將買入腳 (K2) 設定在現價之下 (OTM)，賣出腳 (K1) 作為合理的停利點。",
        legs: [{id:'K1',label:'Short Put K1'},{id:'P1',label:'P1'},{id:'K2',label:'Long Put K2'},{id:'P2',label:'P2'}],
        greekGuide: `<div style="margin-bottom: 15px;"><h4 style="color: #0099ff; margin-bottom: 5px;">📊 總體希臘字母特性</h4><p>Delta: 負 (-) | Theta: 負 (-) | Vega: 正 (+)<br>這是一個需要股價真實往下急跌才能獲利的策略。</p></div><div style="margin-bottom: 15px;"><h4 style="color: #0099ff; margin-bottom: 5px;">🎯 履約價挑選指南</h4><ul style="padding-left: 20px;"><li style="margin-bottom: 5px;">Long Put (K2): 買入接近平值的合約，Delta -0.40 ~ -0.60。</li><li style="margin-bottom: 5px;">Short Put (K1): 賣出價外合約補貼成本，建議挑選 Delta -0.20 ~ -0.30。</li></ul></div><div><h4 style="color: #0099ff; margin-bottom: 5px;">💡 實戰眉角</h4><p>如果股價只是原地盤整，你會因為 Theta 耗損而虧錢。優點是如果發生恐慌性暴跌，正 Vega 會助攻部位價值。</p></div>`
    },
    CallBWBBear: { 
        name: "Call BWB (Bear)", desc: "策略偏空，屬於進階不對稱保險，上行伴隨較大風險，適合預期股價持平或溫和下跌。", 
        rules: ["履約價 (K)：S0 <= K1 < K2 < K3 (整體必須為 Call 且全數在價外建倉)", "翅膀邏輯：(K3 - K2) > (K2 - K1) (右翼大於左翼)", "建倉性質：必須達成淨收入 (Net Credit > 0)，且確保防套利。"],
        adjustHint: "已確保 K1 位於價外之上，且右側價差大於左側，擠出讓下跌完全無敵的淨收入 (Net Credit)。",
        legs: [{id:'K1',label:'Long Call K1'},{id:'P1',label:'P1'},{id:'K2',label:'Short Call K2 (x 2)'},{id:'P2',label:'P2'},{id:'K3',label:'Long Call K3'},{id:'P3',label:'P3'}],
        greekGuide: `
            <div style="margin-bottom: 15px;"><h4 style="color: #0099ff; margin-bottom: 5px;">📊 總體希臘字母特性</h4>
            <p>Delta: 偏負 (-) | Theta: 正 (+) | Vega: 負 (-)<br>這是一個「斷翼」的買權蝴蝶，透過承擔上漲被軋空的尾部風險，換取建倉時的淨收入。</p></div>
            <div style="margin-bottom: 15px;"><h4 style="color: #0099ff; margin-bottom: 5px;">🎯 履約價挑選指南</h4>
            <ul style="padding-left: 20px;">
                <li style="margin-bottom: 5px;">Short Call (K2 x2): 設定在預期股價「漲不破」的壓力位，通常 Delta +0.25 ~ +0.35。</li>
                <li style="margin-bottom: 5px;">Long Call (K1): 買入較接近現價的合約，Delta +0.45 ~ +0.50。</li>
                <li style="margin-bottom: 5px;">Long Call (K3): 斷翼防守腳，Delta +0.05 ~ +0.10。</li>
            </ul></div>
            <div><h4 style="color: #0099ff; margin-bottom: 5px;">💡 實戰眉角</h4>
            <p>確保 K3-K2 的寬距 > K2-K1 的寬距，並創造建倉時的淨收入 (Net Credit)。只要收到錢，股價下跌甚至暴跌你都是穩賺不賠的。</p></div>
        `
    },
    IronCondor: { 
        name: "Iron Condor", desc: "策略中立，適合預期股價在特定區間內震盪盤整。", 
        rules: ["履約價 (K)：K1 < K2 < S0 < K3 < K4 (兩組 Spread 包圍現價)", "權利金 (P)：P1 < P2 且 P4 < P3", "建倉性質：Net Credit = (P2 - P1) + (P3 - P4) > 0", "風控：Net Credit < min((K2 - K1), (K4 - K3)) (確保最大獲利小於最大可能虧損，避免套利)"],
        adjustHint: "已將賣出腳 (K2, K3) 退到 1 SD 安全邊界外。若收不到錢請拉寬兩側的價差或拉長 DTE。",
        legs: [{id:'K1',label:'Long Put K1'},{id:'P1',label:'P1'},{id:'K2',label:'Short Put K2'},{id:'P2',label:'P2'},{id:'K3',label:'Short Call K3'},{id:'P3',label:'P3'},{id:'K4',label:'Long Call K4'},{id:'P4',label:'P4'}],
        greekGuide: `
            <div style="margin-bottom: 15px;"><h4 style="color: #0099ff; margin-bottom: 5px;">📊 總體希臘字母特性</h4>
            <p>Delta: 中立 (0) | Theta: 正 (+) | Vega: 負 (-)<br>這是一座完美對稱的收租城堡，只要股價乖乖待在區間內，你每天都能安穩賺取時間價值。</p></div>
            <div style="margin-bottom: 15px;"><h4 style="color: #0099ff; margin-bottom: 5px;">🎯 履約價挑選指南</h4>
            <ul style="padding-left: 20px;">
                <li style="margin-bottom: 5px;">Short Legs (K2 & K3): 賣出翅膀，建議挑選 Delta 絕對值 0.10 ~ 0.20 (大約在 1~1.5 倍標準差外)，追求 70~80% 以上的高勝率。</li>
                <li style="margin-bottom: 5px;">Long Legs (K1 & K4): 買入保險，建議挑選 Delta 絕對值 0.02 ~ 0.08 的便宜合約，鎖死極端風險。</li>
            </ul></div>
            <div><h4 style="color: #0099ff; margin-bottom: 5px;">💡 實戰眉角</h4>
            <p>強烈建議在 DTE 30~45 天建倉，並在 DTE 剩餘 14~21 天 或 獲利達到最大利潤的 50% 時提早平倉了結，避開末期 Gamma 風險。</p></div>
        `
    },
    JadeLizard: { 
        name: "Jade Lizard", desc: "策略微偏多與中立，適合預期股價盤整且不發生暴跌。", 
        rules: ["履約價 (K)：K1 < S0 < K2 < K3 (K1 為遠價外 Short Put，K2, K3 為上方 Bear Call Spread)", "權利金 (P)：P1 > 0 且 P2 > P3", "建倉性質：Net Credit >= (K3 - K2) (確保權利金收入覆蓋上行履約價差)"],
        adjustHint: "已將賣出腳推往安全邊界。請確認市場中的總權利金收入 ≥ (K3-K2 的寬度)，以消除上行風險。",
        legs: [{id:'K1',label:'Short Put K1'},{id:'P1',label:'P1'},{id:'K2',label:'Short Call K2'},{id:'P2',label:'P2'},{id:'K3',label:'Long Call K3'},{id:'P3',label:'P3'}],
        greekGuide: `
            <div style="margin-bottom: 15px;"><h4 style="color: #0099ff; margin-bottom: 5px;">📊 總體希臘字母特性</h4>
            <p>Delta: 偏正 (+) | Theta: 正 (+) | Vega: 負 (-)<br>這是一個「不怕股票大漲，只怕股票大跌」的收租策略。</p></div>
            <div style="margin-bottom: 15px;"><h4 style="color: #0099ff; margin-bottom: 5px;">🎯 履約價挑選指南</h4>
            <ul style="padding-left: 20px;">
                <li style="margin-bottom: 5px;">Short Put (K1): 挑選 Delta -0.15 ~ -0.25 的支撐位。</li>
                <li style="margin-bottom: 5px;">Short Call (K2): 挑選 Delta +0.25 ~ +0.30。</li>
                <li style="margin-bottom: 5px;">Long Call (K3): 挑選 Delta +0.10 ~ +0.15 鎖住上方風險。</li>
            </ul></div>
            <div><h4 style="color: #0099ff; margin-bottom: 5px;">💡 實戰眉角</h4>
            <p>玉蜥蜴的核心紀律：總淨權利金 (Net Credit)，必須大於或等於 Call 邊的履約價差 (K3-K2)。只要符合條件，即使股票暴漲到外太空，依然是獲利的！</p></div>
        `
    },
    Strangle: { 
        name: "Short Strangle", desc: "策略中立，適合預期股價在寬廣區間內盤整，但需嚴格控管保證金。", 
        rules: ["履約價 (K)：K1 < S0 < K2 (Put 賣在現價之下，Call 賣在現價之上)", "建倉性質：Net Credit > 0"],
        adjustHint: "雙向裸賣風險極高，已將 K1 與 K2 退到遠離現價 (1 SD 之外) 的位置。",
        legs: [{id:'K1',label:'Short Put K1'},{id:'P1',label:'P1'},{id:'K2',label:'Short Call K2'},{id:'P2',label:'P2'}],
        greekGuide: `
            <div style="margin-bottom: 15px;"><h4 style="color: #0099ff; margin-bottom: 5px;">📊 總體希臘字母特性</h4>
            <p>Delta: 中立 (0) | Theta: 正 (+) | Vega: 負 (-)<br>沒有任何買權保護，收取豐厚權利金，但承擔雙向無限風險。</p></div>
            <div style="margin-bottom: 15px;"><h4 style="color: #0099ff; margin-bottom: 5px;">🎯 履約價挑選指南</h4>
            <ul style="padding-left: 20px;">
                <li style="margin-bottom: 5px;">Short Put & Call (K1, K2): 建議挑選 Delta 0.10 ~ 0.20 的位置 (約在 1 ~ 1.5 倍標準差區間外)。</li>
            </ul></div>
            <div><h4 style="color: #0099ff; margin-bottom: 5px;">💡 實戰眉角</h4>
            <p>嚴禁在重大財報發布前、或市場有重大未知事件時無腦持有。建議 IV Rank 極高 (>70%) 且判斷即將回落時才使用。</p></div>
        `
    },
    CallButterfly: { 
        name: "Call Butterfly", desc: "策略高度中立，適合預期股價結算時精準落在中間履約價。", 
        rules: ["履約價 (K)：K1 < K2 < K3，且 K2 必須貼近現價 S0。", "翅膀邏輯：左右完全等寬，即 (K2-K1) = (K3-K2)", "建倉性質：Net Debit = (P1 + P3) - 2 * P2 > 0"],
        adjustHint: "這是一個定點狙擊策略。已將 K2 對準現價附近，並確保左右兩翼完全等寬。",
        legs: [{id:'K1',label:'Long Call K1'},{id:'P1',label:'P1'},{id:'K2',label:'Short Call K2 (x 2)'},{id:'P2',label:'P2'},{id:'K3',label:'Long Call K3'},{id:'P3',label:'P3'}],
        greekGuide: `
            <div style="margin-bottom: 15px;"><h4 style="color: #0099ff; margin-bottom: 5px;">📊 總體希臘字母特性</h4>
            <p>Delta: 中立 (0) | Theta: 正 (+) | Vega: 負 (-)<br>這是一個「狙擊手」策略，必須精準預測結算日時股價會落在哪個定點。</p></div>
            <div style="margin-bottom: 15px;"><h4 style="color: #0099ff; margin-bottom: 5px;">🎯 履約價挑選指南</h4>
            <ul style="padding-left: 20px;">
                <li style="margin-bottom: 5px;">Short Legs (K2 x2): 設定在你預測的目標價格。</li>
                <li style="margin-bottom: 5px;">Long Wings (K1, K3): 距離 K2 必須等寬，決定了最大風險與獲利範圍，通常抓 $5~$10 點寬度。</li>
            </ul></div>
            <div><h4 style="color: #0099ff; margin-bottom: 5px;">💡 實戰眉角</h4>
            <p>建倉成本極低，最大盈虧比可達 1:5 甚至 1:10，但勝率較低。越接近結算日，尖峰部位的利潤膨脹越快。</p></div>
        `
    },
    PutButterfly: { 
        name: "Put Butterfly", desc: "策略高度中立，適合預期股價結算時精準落在中間履約價。", 
        rules: ["履約價 (K)：K1 < K2 < K3，且 K2 必須貼近現價 S0。", "翅膀邏輯：左右完全等寬，即 (K2-K1) = (K3-K2)", "建倉性質：Net Debit = (P1 + P3) - 2 * P2 > 0"],
        adjustHint: "這是一個定點狙擊策略。已將 K2 對準現價附近，並確保左右兩翼完全等寬。",
        legs: [{id:'K1',label:'Long Put K1'},{id:'P1',label:'P1'},{id:'K2',label:'Short Put K2 (x 2)'},{id:'P2',label:'P2'},{id:'K3',label:'Long Put K3'},{id:'P3',label:'P3'}],
        greekGuide: `
            <div style="margin-bottom: 15px;"><h4 style="color: #0099ff; margin-bottom: 5px;">📊 總體希臘字母特性</h4>
            <p>Delta: 中立 (0) | Theta: 正 (+) | Vega: 負 (-)<br>這是一個「狙擊手」策略，必須精準預測結算日時股價會落在哪個定點。</p></div>
            <div style="margin-bottom: 15px;"><h4 style="color: #0099ff; margin-bottom: 5px;">🎯 履約價挑選指南</h4>
            <ul style="padding-left: 20px;">
                <li style="margin-bottom: 5px;">Short Legs (K2 x2): 設定在你預測的目標價格。</li>
                <li style="margin-bottom: 5px;">Long Wings (K1, K3): 距離 K2 必須等寬，決定了最大風險與獲利範圍，通常抓 $5~$10 點寬度。</li>
            </ul></div>
            <div><h4 style="color: #0099ff; margin-bottom: 5px;">💡 實戰眉角</h4>
            <p>建倉成本極低，最大盈虧比可達 1:5 甚至 1:10，但勝率較低。越接近結算日，尖峰部位的利潤膨脹越快。</p></div>
        `
    }
};

function rand(min, max) { return parseFloat((Math.random() * (max - min) + min).toFixed(2)); }
function roundK(val) { return parseFloat(val.toFixed(2)); }

function calculatePLData(strategy, params) {
    const { K1, K2, K3, K4, P1, P2, P3, P4, S0, IV, DTE } = params;
    let res = [], net = 0, nF = '', dispMP = '', mPF = '', dispML = '', mLF = '', bR = '', bF = '', sDiff = '', sdF = '', cPV = 0, cPF = '';

    const longC = (K, P, S) => Math.max(0, S - K) - P;
    const shortC = (K, P, S) => P - Math.max(0, S - K);
    const longP = (K, P, S) => Math.max(0, K - S) - P;
    const shortP = (K, P, S) => P - Math.max(0, K - S);

    const getPL = (S) => {
        switch (strategy) {
            case 'ShortPut': return shortP(K1, P1, S);
            case 'BullPutSpread': return longP(K1, P1, S) + shortP(K2, P2, S);
            case 'BullCallSpread': return longC(K1, P1, S) + shortC(K2, P2, S);
            case 'BearCallSpread': return shortC(K1, P1, S) + longC(K2, P2, S);
            case 'BearPutSpread': return shortP(K1, P1, S) + longP(K2, P2, S);
            case 'IronCondor': return longP(K1, P1, S) + shortP(K2, P2, S) + shortC(K3, P3, S) + longC(K4, P4, S);
            case 'Strangle': return shortP(K1, P1, S) + shortC(K2, P2, S);
            case 'CallButterfly': return longC(K1, P1, S) + 2 * shortC(K2, P2, S) + longC(K3, P3, S);
            case 'PutButterfly': return longP(K1, P1, S) + 2 * shortP(K2, P2, S) + longP(K3, P3, S);
            case 'JadeLizard': return shortP(K1, P1, S) + shortC(K2, P2, S) + longC(K3, P3, S);
            case 'PutBWBBull': return longP(K1, P1, S) + 2 * shortP(K2, P2, S) + longP(K3, P3, S);
            case 'CallBWBBear': return longC(K1, P1, S) + 2 * shortC(K2, P2, S) + longC(K3, P3, S);
            case 'PutRatioSpreadBull': return longP(K1, P1, S) + 2 * shortP(K2, P2, S);
            default: return 0;
        }
    };
    cPV = getPL(S0);

    const vSP1 = K1 > S0 ? parseFloat((K1 - S0).toFixed(2)) : 0;
    const vSP2 = K2 > S0 ? parseFloat((K2 - S0).toFixed(2)) : 0;
    const vSC1 = S0 > K1 ? parseFloat((S0 - K1).toFixed(2)) : 0;
    const vSC2 = S0 > K2 ? parseFloat((S0 - K2).toFixed(2)) : 0;
    const vLC1 = S0 > K1 ? parseFloat((S0 - K1).toFixed(2)) : 0;
    const vLC2 = S0 > K2 ? parseFloat((S0 - K2).toFixed(2)) : 0;
    const vLP1 = K1 > S0 ? parseFloat((K1 - S0).toFixed(2)) : 0;
    const vLP2 = K2 > S0 ? parseFloat((K2 - S0).toFixed(2)) : 0;
    const vLP3 = K3 > S0 ? parseFloat((K3 - S0).toFixed(2)) : 0;
    const vSC3 = S0 > K3 ? parseFloat((S0 - K3).toFixed(2)) : 0;
    const vLC3 = S0 > K3 ? parseFloat((S0 - K3).toFixed(2)) : 0;
    const vLC4 = S0 > K4 ? parseFloat((S0 - K4).toFixed(2)) : 0;

    const formatSignedNum = (num) => num >= 0 ? `+ ${num.toFixed(2)}` : `- ${Math.abs(num).toFixed(2)}`;

    switch (strategy) {
        case 'ShortPut':
            net = P1; nF = `計算過程：收入 P1 = ${P1.toFixed(2)}`; dispMP = `${P1.toFixed(2)} (當股價在 ${K1.toFixed(2)} 之上)`; mPF = `計算過程：獲利上限 = 權利金`; dispML = `無限 (當股價在 ${K1.toFixed(2)} 之下)`; mLF = `說明：風險隨股價下跌無限擴大`; bR = (K1 - P1).toFixed(2); bF = `計算過程：${K1.toFixed(2)} - ${P1.toFixed(2)} = ${bR}`; sDiff = "單腿"; sdF = "說明：無兩腿價差。"; 
            cPF = `計算過程：P1 - Max(0, K1 - S0) = ${P1.toFixed(2)} - ${vSP1.toFixed(2)} = ${cPV.toFixed(2)}`; break;
        case 'BullPutSpread':
            net = P2 - P1; nF = `計算過程：${P2.toFixed(2)} - ${P1.toFixed(2)} = ${net.toFixed(2)}`; dispMP = `${net.toFixed(2)} (當股價在 ${K2.toFixed(2)} 之上)`; mPF = `計算過程：淨收入 = 獲利上限`; dispML = `${((K2 - K1) - net).toFixed(2)} (當股價在 ${K1.toFixed(2)} 之下)`; mLF = `計算過程：(K2 - K1) - 淨收入 = (${K2.toFixed(2)} - ${K1.toFixed(2)}) - ${net.toFixed(2)} = ${((K2 - K1) - net).toFixed(2)}`; bR = (K2 - net).toFixed(2); bF = `計算過程：${K2.toFixed(2)} - ${net.toFixed(2)} = ${bR}`; sDiff = (K2 - K1).toFixed(2); sdF = `計算過程：${K2.toFixed(2)} - ${K1.toFixed(2)} = ${sDiff}`; 
            const bps1 = parseFloat((vLP1 - P1).toFixed(2)); const bps2 = parseFloat((P2 - vSP2).toFixed(2));
            cPF = `計算過程：(Max(0, K1 - S0) - P1) + (P2 - Max(0, K2 - S0)) = (${vLP1.toFixed(2)} - ${P1.toFixed(2)}) + (${P2.toFixed(2)} - ${vSP2.toFixed(2)}) = ${bps1.toFixed(2)} ${formatSignedNum(bps2)} = ${cPV.toFixed(2)}`; break;
        case 'BullCallSpread':
            net = - (P1 - P2); const bcl = P1 - P2; nF = `計算過程：- (${P1.toFixed(2)} - ${P2.toFixed(2)}) = - ${bcl.toFixed(2)}`; dispML = `${bcl.toFixed(2)} (當股價在 ${K1.toFixed(2)} 之下)`; mLF = `計算過程：淨支出 = 最大損失`; dispMP = `${((K2 - K1) - bcl).toFixed(2)} (當股價在 ${K2.toFixed(2)} 之上)`; mPF = `計算過程：(K2 - K1) - 淨支出 = (${K2.toFixed(2)} - ${K1.toFixed(2)}) - ${bcl.toFixed(2)} = ${((K2 - K1) - bcl).toFixed(2)}`; bR = (K1 + bcl).toFixed(2); bF = `計算過程：${K1.toFixed(2)} + ${bcl.toFixed(2)} = ${bR}`; sDiff = (K2 - K1).toFixed(2); sdF = `計算過程：${K2.toFixed(2)} - ${K1.toFixed(2)} = ${sDiff}`; 
            const bcs1 = parseFloat((vLC1 - P1).toFixed(2)); const bcs2 = parseFloat((P2 - vSC2).toFixed(2));
            cPF = `計算過程：(Max(0, S0 - K1) - P1) + (P2 - Max(0, S0 - K2)) = (${vLC1.toFixed(2)} - ${P1.toFixed(2)}) + (${P2.toFixed(2)} - ${vSC2.toFixed(2)}) = ${bcs1.toFixed(2)} ${formatSignedNum(bcs2)} = ${cPV.toFixed(2)}`; break;
        case 'BearCallSpread':
            net = P1 - P2; nF = `計算過程：${P1.toFixed(2)} - ${P2.toFixed(2)} = ${net.toFixed(2)}`; dispMP = `${net.toFixed(2)} (當股價在 ${K1.toFixed(2)} 之下)`; mPF = `計算過程：淨收入 = 獲利上限`; dispML = `${((K2 - K1) - net).toFixed(2)} (當股價在 ${K2.toFixed(2)} 之上)`; mLF = `計算過程：(K2 - K1) - 淨收入 = (${K2.toFixed(2)} - ${K1.toFixed(2)}) - ${net.toFixed(2)} = ${((K2 - K1) - net).toFixed(2)}`; bR = (K1 + net).toFixed(2); bF = `計算過程：${K1.toFixed(2)} + ${net.toFixed(2)} = ${bR}`; sDiff = (K2 - K1).toFixed(2); sdF = `計算過程：${K2.toFixed(2)} - ${K1.toFixed(2)} = ${sDiff}`; 
            const bcc1 = parseFloat((P1 - vSC1).toFixed(2)); const bcc2 = parseFloat((vLC2 - P2).toFixed(2));
            cPF = `計算過程：(P1 - Max(0, S0 - K1)) + (Max(0, S0 - K2) - P2) = (${P1.toFixed(2)} - ${vSC1.toFixed(2)}) + (${vLC2.toFixed(2)} - ${P2.toFixed(2)}) = ${bcc1.toFixed(2)} ${formatSignedNum(bcc2)} = ${cPV.toFixed(2)}`; break;
        case 'BearPutSpread':
            net = - (P2 - P1); const bpc = P2 - P1; nF = `計算過程：- (${P2.toFixed(2)} - ${P1.toFixed(2)}) = - ${bpc.toFixed(2)}`; dispML = `${bpc.toFixed(2)} (當股價在 ${K2.toFixed(2)} 之上)`; mLF = `計算過程：淨支出 = 最大損失`; dispMP = `${((K2 - K1) - bpc).toFixed(2)} (當股價在 ${K1.toFixed(2)} 之下)`; mPF = `計算過程：(K2 - K1) - 淨支出 = (${K2.toFixed(2)} - ${K1.toFixed(2)}) - ${bpc.toFixed(2)} = ${((K2 - K1) - bpc).toFixed(2)}`; bR = (K2 - bpc).toFixed(2); bF = `計算過程：${K2.toFixed(2)} - ${bpc.toFixed(2)} = ${bR}`; sDiff = (K2 - K1).toFixed(2); sdF = `計算過程：${K2.toFixed(2)} - ${K1.toFixed(2)} = ${sDiff}`; 
            const bpc1 = parseFloat((P1 - vSP1).toFixed(2)); const bpc2 = parseFloat((vLP2 - P2).toFixed(2));
            cPF = `計算過程：(P1 - Max(0, K1 - S0)) + (Max(0, K2 - S0) - P2) = (${P1.toFixed(2)} - ${vSP1.toFixed(2)}) + (${vLP2.toFixed(2)} - ${P2.toFixed(2)}) = ${bpc1.toFixed(2)} ${formatSignedNum(bpc2)} = ${cPV.toFixed(2)}`; break;
        case 'IronCondor':
            net = (P2 + P3) - (P1 + P4); nF = `計算過程：(${P2.toFixed(2)} + ${P3.toFixed(2)}) - (${P1.toFixed(2)} + ${P4.toFixed(2)}) = ${net.toFixed(2)}`; dispMP = `${net.toFixed(2)} (當股價介於 ${K2.toFixed(2)} 與 ${K3.toFixed(2)} 之間)`; mPF = `計算過程：總淨收入 = 獲利上限`; const ic_dp = K2 - K1; const ic_dc = K4 - K3; const ic_ml = Math.max(ic_dp, ic_dc) - net; dispML = `${ic_ml.toFixed(2)} (當股價在 ${K1.toFixed(2)} 之下或 ${K4.toFixed(2)} 之上)`; mLF = `計算過程：MAX(${ic_dp.toFixed(2)}, ${ic_dc.toFixed(2)}) - ${net.toFixed(2)} = ${ic_ml.toFixed(2)}`; bR = `${(K2 - net).toFixed(2)} / ${(K3 + net).toFixed(2)}`; bF = `計算過程：P端:K2-Net | C端:K3+Net`; sDiff = `P:${ic_dp.toFixed(2)} / C:${ic_dc.toFixed(2)}`; sdF = `計算過程：兩側價差分析`; 
            const icp1 = parseFloat((vLP1 - P1).toFixed(2)); const icp2 = parseFloat((P2 - vSP2).toFixed(2)); const icp3 = parseFloat((P3 - vSC3).toFixed(2)); const icp4 = parseFloat((vLC4 - P4).toFixed(2));
            cPF = `計算過程：(Max(0, K1 - S0) - P1) + (P2 - Max(0, K2 - S0)) + (P3 - Max(0, S0 - K3)) + (Max(0, S0 - K4) - P4) = (${vLP1.toFixed(2)} - ${P1.toFixed(2)}) + (${P2.toFixed(2)} - ${vSP2.toFixed(2)}) + (${P3.toFixed(2)} - ${vSC3.toFixed(2)}) + (${vLC4.toFixed(2)} - ${P4.toFixed(2)}) = ${icp1.toFixed(2)} ${formatSignedNum(icp2)} ${formatSignedNum(icp3)} ${formatSignedNum(icp4)} = ${cPV.toFixed(2)}`; break;
        case 'Strangle':
            net = P1 + P2; nF = `計算過程：${P1.toFixed(2)} + ${P2.toFixed(2)} = ${net.toFixed(2)}`; dispMP = `${net.toFixed(2)} (當股價介於 ${K1.toFixed(2)} 與 ${K2.toFixed(2)} 之間)`; mPF = `計算過程：權利金總收 = 獲利上限`; dispML = `無限 (當股價突破損益平衡點)`; mLF = `說明：雙向裸賣，風險無限`; bR = `${(K1 - net).toFixed(2)} / ${(K2 + net).toFixed(2)}`; bF = `計算過程：P端:K1-Net | C端:K2+Net`; sDiff = (K2 - K1).toFixed(2); sdF = `計算過程：${K2.toFixed(2)} - ${K1.toFixed(2)} = ${sDiff}`; 
            const stp1 = parseFloat((P1 - vSP1).toFixed(2)); const stp2 = parseFloat((P2 - vSC2).toFixed(2));
            cPF = `計算過程：(P1 - Max(0, K1 - S0)) + (P2 - Max(0, S0 - K2)) = (${P1.toFixed(2)} - ${vSP1.toFixed(2)}) + (${P2.toFixed(2)} - ${vSC2.toFixed(2)}) = ${stp1.toFixed(2)} ${formatSignedNum(stp2)} = ${cPV.toFixed(2)}`; break;
        case 'CallButterfly':
            net = - (P1 + P3 - 2 * P2); const cbf_debit = P1 + P3 - 2 * P2; nF = `計算過程：- (${P1.toFixed(2)} + ${P3.toFixed(2)} - 2 * ${P2.toFixed(2)}) = - ${cbf_debit.toFixed(2)}`; dispML = `${cbf_debit.toFixed(2)} (當股價在 ${K1.toFixed(2)} 之下或 ${K3.toFixed(2)} 之上)`; mLF = `計算過程：淨支出 = 最大損失`; dispMP = `${((K2 - K1) - cbf_debit).toFixed(2)} (當股價等於 ${K2.toFixed(2)})`; mPF = `計算過程：(${K2.toFixed(2)} - ${K1.toFixed(2)}) - ${cbf_debit.toFixed(2)} = ${((K2 - K1) - cbf_debit).toFixed(2)}`; bR = `${(K1 + cbf_debit).toFixed(2)} / ${(K3 - cbf_debit).toFixed(2)}`; bF = `計算過程：L:K1+Net | H:K3-Net`; sDiff = (K2 - K1).toFixed(2); sdF = `計算過程：單側翼展 ${K2.toFixed(2)} - ${K1.toFixed(2)} = ${sDiff}`; 
            const cbfp1 = parseFloat((vLC1 - P1).toFixed(2)); const cbfp2 = parseFloat((2 * (P2 - vSC2)).toFixed(2)); const cbfp3 = parseFloat((vLC3 - P3).toFixed(2));
            cPF = `計算過程：(Max(0, S0 - K1) - P1) + 2 * (P2 - Max(0, S0 - K2)) + (Max(0, S0 - K3) - P3) = (${vLC1.toFixed(2)} - ${P1.toFixed(2)}) + 2 * (${P2.toFixed(2)} - ${vSC2.toFixed(2)}) + (${vLC3.toFixed(2)} - ${P3.toFixed(2)}) = ${cbfp1.toFixed(2)} ${formatSignedNum(cbfp2)} ${formatSignedNum(cbfp3)} = ${cPV.toFixed(2)}`; break;
        case 'PutButterfly':
            net = - (P1 + P3 - 2 * P2); const pbf_debit = P1 + P3 - 2 * P2; nF = `計算過程：- (${P1.toFixed(2)} + ${P3.toFixed(2)} - 2 * ${P2.toFixed(2)}) = - ${pbf_debit.toFixed(2)}`; dispML = `${pbf_debit.toFixed(2)} (當股價在 ${K1.toFixed(2)} 之下或 ${K3.toFixed(2)} 之上)`; mLF = `計算過程：淨支出 = 最大損失`; dispMP = `${((K2 - K1) - pbf_debit).toFixed(2)} (當股價等於 ${K2.toFixed(2)})`; mPF = `計算過程：(${K2.toFixed(2)} - ${K1.toFixed(2)}) - ${pbf_debit.toFixed(2)} = ${((K2 - K1) - pbf_debit).toFixed(2)}`; bR = `${(K1 + pbf_debit).toFixed(2)} / ${(K3 - pbf_debit).toFixed(2)}`; bF = `計算過程：L:K1+Net | H:K3-Net`; sDiff = (K2 - K1).toFixed(2); sdF = `計算過程：單側翼展 ${K2.toFixed(2)} - ${K1.toFixed(2)} = ${sDiff}`; 
            const pbfp1 = parseFloat((vLP1 - P1).toFixed(2)); const pbfp2 = parseFloat((2 * (P2 - vSP2)).toFixed(2)); const pbfp3 = parseFloat((vLP3 - P3).toFixed(2));
            cPF = `計算過程：(Max(0, K1 - S0) - P1) + 2 * (P2 - Max(0, K2 - S0)) + (Max(0, K3 - S0) - P3) = (${vLP1.toFixed(2)} - ${P1.toFixed(2)}) + 2 * (${P2.toFixed(2)} - ${vSP2.toFixed(2)}) + (${vLP3.toFixed(2)} - ${P3.toFixed(2)}) = ${pbfp1.toFixed(2)} ${formatSignedNum(pbfp2)} ${formatSignedNum(pbfp3)} = ${cPV.toFixed(2)}`; break;
        case 'JadeLizard':
            net = P1 + (P2 - P3); nF = `計算過程：${P1.toFixed(2)} + (${P2.toFixed(2)} - ${P3.toFixed(2)}) = ${net.toFixed(2)}`; dispMP = `${net.toFixed(2)} (當股價在 ${K2.toFixed(2)} 之上)`; mPF = `計算過程：總收入 = 獲利上限`; dispML = `無限 (當股價在 ${K1.toFixed(2)} 之下)`; mLF = `說明：下行賣權裸賣風險無限`; bR = (K1 - net).toFixed(2); bF = `計算過程：${K1.toFixed(2)} - ${net.toFixed(2)} = ${bR}`; sDiff = "混合"; sdF = "說明：無單一價差。"; 
            const jlp1 = parseFloat((P1 - vSP1).toFixed(2)); const jlp2 = parseFloat((P2 - vSC2).toFixed(2)); const jlp3 = parseFloat((vLC3 - P3).toFixed(2));
            cPF = `計算過程：(P1 - Max(0, K1 - S0)) + (P2 - Max(0, S0 - K2)) + (Max(0, S0 - K3) - P3) = (${P1.toFixed(2)} - ${vSP1.toFixed(2)}) + (${P2.toFixed(2)} - ${vSC2.toFixed(2)}) + (${vLC3.toFixed(2)} - ${P3.toFixed(2)}) = ${jlp1.toFixed(2)} ${formatSignedNum(jlp2)} ${formatSignedNum(jlp3)} = ${cPV.toFixed(2)}`; break;
        case 'PutRatioSpreadBull':
            net = (2 * P2) - P1; 
            nF = `計算過程：(2 * ${P2.toFixed(2)}) - ${P1.toFixed(2)} = ${net.toFixed(2)}`; 
            const prs_maxP = (K1 - K2) + net;
            dispMP = `${prs_maxP.toFixed(2)} (當股價等於 ${K2.toFixed(2)})`; 
            mPF = `計算過程：履約價差 ${(K1 - K2).toFixed(2)} + 淨收入 ${net.toFixed(2)} = ${prs_maxP.toFixed(2)}`; 
            dispML = `無限 (當股價下跌時)`; 
            mLF = `說明：1 買 2 賣下行風險無限`; 
            bR = (2 * K2 - K1 - net).toFixed(2); 
            bF = `計算過程：2 * ${K2.toFixed(2)} - ${K1.toFixed(2)} - ${net.toFixed(2)} = ${bR}`; 
            sDiff = (K1 - K2).toFixed(2); 
            sdF = `計算過程：${K1.toFixed(2)} - ${K2.toFixed(2)} = ${sDiff}`; 
            const prs1 = parseFloat((vLP1 - P1).toFixed(2)); 
            const prs2 = parseFloat((2 * (P2 - vSP2)).toFixed(2));
            cPF = `計算過程：(Max(0, K1 - S0) - P1) + 2 * (P2 - Max(0, K2 - S0)) = (${vLP1.toFixed(2)} - ${P1.toFixed(2)}) + 2 * (${P2.toFixed(2)} - ${vSP2.toFixed(2)}) = ${prs1.toFixed(2)} ${formatSignedNum(prs2)} = ${cPV.toFixed(2)}`; 
            break;
        case 'PutBWBBull':
            net = (2 * P2) - P1 - P3; const bwb_dl = K2 - K1; const bwb_dr = K3 - K2; nF = `計算過程：(2 * ${P2.toFixed(2)}) - ${P1.toFixed(2)} - ${P3.toFixed(2)} = ${net.toFixed(2)}`; dispMP = `${(bwb_dr + net).toFixed(2)} (當股價等於 ${K2.toFixed(2)})`; mPF = `計算過程：(${K3.toFixed(2)} - ${K2.toFixed(2)}) + ${net.toFixed(2)} = ${(bwb_dr + net).toFixed(2)}`; dispML = `${(bwb_dl - bwb_dr - net).toFixed(2)} (當股價在 ${K1.toFixed(2)} 之下)`; mLF = `計算過程：(${K2.toFixed(2)} - ${K1.toFixed(2)}) - (${K3.toFixed(2)} - ${K2.toFixed(2)}) - ${net.toFixed(2)} = ${(bwb_dl - bwb_dr - net).toFixed(2)}`; bR = (K2 - (bwb_dr + net)).toFixed(2); bF = `計算過程：${K2.toFixed(2)} - ${(bwb_dr + net).toFixed(2)} = ${bR}`; sDiff = `L:${bwb_dl.toFixed(2)} / R:${bwb_dr.toFixed(2)}`; sdF = `計算過程：邊翼價差分析`; 
            const pbwb1 = parseFloat((vLP1 - P1).toFixed(2)); const pbwb2 = parseFloat((2 * (P2 - vSP2)).toFixed(2)); const pbwb3 = parseFloat((vLP3 - P3).toFixed(2));
            cPF = `計算過程：(Max(0, K1 - S0) - P1) + 2 * (P2 - Max(0, K2 - S0)) + (Max(0, K3 - S0) - P3) = (${vLP1.toFixed(2)} - ${P1.toFixed(2)}) + 2 * (${P2.toFixed(2)} - ${vSP2.toFixed(2)}) + (${vLP3.toFixed(2)} - ${P3.toFixed(2)}) = ${pbwb1.toFixed(2)} ${formatSignedNum(pbwb2)} ${formatSignedNum(pbwb3)} = ${cPV.toFixed(2)}`; break;
        case 'CallBWBBear':
            net = (2 * P2) - P1 - P3; const cbwb_cl = K2 - K1; const cbwb_cr = K3 - K2; nF = `計算過程：(2 * ${P2.toFixed(2)}) - ${P1.toFixed(2)} - ${P3.toFixed(2)} = ${net.toFixed(2)}`; dispMP = `${(cbwb_cl + net).toFixed(2)} (當股價等於 ${K2.toFixed(2)})`; mPF = `計算過程：(${K2.toFixed(2)} - ${K1.toFixed(2)}) + ${net.toFixed(2)} = ${(cbwb_cl + net).toFixed(2)}`; dispML = `${(cbwb_cr - cbwb_cl - net).toFixed(2)} (當股價在 ${K3.toFixed(2)} 之上)`; mLF = `計算過程：(${K3.toFixed(2)} - ${K2.toFixed(2)}) - (${K2.toFixed(2)} - ${K1.toFixed(2)}) - ${net.toFixed(2)} = ${(cbwb_cr - cbwb_cl - net).toFixed(2)}`; 
            bR = (K2 + (cbwb_cl + net)).toFixed(2); 
            bF = `計算過程：${K2.toFixed(2)} + ${(cbwb_cl + net).toFixed(2)} = ${bR}`; sDiff = `L:${cbwb_cl.toFixed(2)} / R:${cbwb_cr.toFixed(2)}`; sdF = `計算過程：邊翼價差分析`; 
            const cbwb1 = parseFloat((vLC1 - P1).toFixed(2)); const cbwb2 = parseFloat((2 * (P2 - vSC2)).toFixed(2)); const cbwb3 = parseFloat((vLC3 - P3).toFixed(2));
            cPF = `計算過程：(Max(0, S0 - K1) - P1) + 2 * (P2 - Max(0, S0 - K2)) + (Max(0, S0 - K3) - P3) = (${vLC1.toFixed(2)} - ${P1.toFixed(2)}) + 2 * (${P2.toFixed(2)} - ${vSC2.toFixed(2)}) + (${vLC3.toFixed(2)} - ${P3.toFixed(2)}) = ${cbwb1.toFixed(2)} ${formatSignedNum(cbwb2)} ${formatSignedNum(cbwb3)} = ${cPV.toFixed(2)}`; break;
        default: dispMP = "0"; dispML = "0"; cPF = "請輸入參數";
    }

    let crucialPoints = [S0];
    [K1, K2, K3, K4].forEach(k => { if (!isNaN(k) && k > 0) crucialPoints.push(k); });
    const bepMatches = bR.match(/[\d.]+/g) || [];
    bepMatches.forEach(b => crucialPoints.push(parseFloat(b)));
    if (IV > 0 && DTE > 0) {
        const em = S0 * (IV / 100) * Math.sqrt(DTE / 365);
        crucialPoints.push(S0 - em);
        crucialPoints.push(S0 + em);
    }

    let minPrice = Math.min(...crucialPoints);
    let maxPrice = Math.max(...crucialPoints);
    let range = maxPrice - minPrice;
    if (range === 0) range = S0 * 0.1; 

    let startPrice = Math.max(0.01, minPrice - range * 0.35); 
    let endPrice = maxPrice + range * 0.35; 

    let keyPointsSet = new Set();
    let step = parseFloat(((endPrice - startPrice) / 300).toFixed(2));
    if(step <= 0.01) step = 0.01;
    for (let s = startPrice; s <= endPrice; s += step) {
        keyPointsSet.add(parseFloat(s.toFixed(2)));
    }
    crucialPoints.forEach(p => keyPointsSet.add(parseFloat(p.toFixed(2))));

    let sortedPoints = Array.from(keyPointsSet).sort((a, b) => a - b);
    for (let s of sortedPoints) {
        res.push({ stockPrice: s, profitAndLoss: getPL(s) });
    }
    
    return { data: res, netPremium: net, netPremiumFormula: nF, maxProfit: dispMP, maxLoss: dispML, maxProfitFormula: mPF, maxLossFormula: mLF, bepFormula: bF, breakeven: bR, S0, IV, DTE, strategy, sDiffText: sDiff, sDiffFormula: sdF, currentPLValue: cPV.toFixed(2), currentPLFormula: cPF };
}

function generateLogicParams(strategy, S0, IV, DTE) {
    const p = {}; let safetyCheck = false;
    p.IV = IV; p.DTE = DTE; 
    let em = S0 * (IV / 100) * Math.sqrt(DTE / 365);
    if (em < 2 && S0 > 0) em = 2; 

    while (!safetyCheck) {
        switch (strategy) {
            case 'ShortPut': 
                p.K1 = roundK(S0 - em - rand(0, 3)); p.P1 = rand(1.5, 5.5); 
                break;
            case 'BullPutSpread': 
                p.K2 = roundK(S0 - Math.max(0.5, em / 2) - rand(0, 2)); p.K1 = roundK(p.K2 - rand(3, 8)); 
                p.P2 = rand(4, 9); p.P1 = rand(1, p.P2 - 0.5); 
                break;
            case 'BullCallSpread': 
                p.K1 = roundK(S0 + rand(0.5, 2)); p.K2 = roundK(p.K1 + rand(4, em)); 
                p.P1 = rand(5, 12); p.P2 = rand(1, p.P1 - 0.5); 
                break;
            case 'BearCallSpread': 
                p.K1 = roundK(S0 + Math.max(0.5, em / 2) + rand(0, 2)); p.K2 = roundK(p.K1 + rand(4, 8)); 
                p.P1 = rand(5, 10); p.P2 = rand(1, p.P1 - 0.5); 
                break;
            case 'BearPutSpread': 
                p.K2 = roundK(S0 - rand(0.5, 2)); p.K1 = roundK(p.K2 - rand(4, em)); 
                p.P2 = rand(6, 12); p.P1 = rand(1, p.P2 - 0.5); 
                break;
            case 'PutRatioSpreadBull': 
                p.K1 = roundK(S0 - rand(1, 3)); 
                p.K2 = roundK(p.K1 - rand(4, em + 2)); 
                if (p.K2 >= p.K1) p.K2 = roundK(p.K1 - 2.11);
                p.P1 = rand(3, 6);
                let minP2_prs = (p.P1 / 2) + 0.1;
                let maxP2_prs = Math.min(p.P1 - 0.1, (p.K1 - p.K2 + p.P1) / 2 - 0.1);
                if(minP2_prs >= maxP2_prs) { p.K2 -= 2; maxP2_prs = Math.min(p.P1 - 0.1, (p.K1 - p.K2 + p.P1) / 2 - 0.1); }
                p.P2 = rand(minP2_prs, maxP2_prs); 
                break;
            case 'PutBWBBull': 
                p.K3 = roundK(S0 - rand(1, 3)); 
                let wR_pbwb = rand(2, 5); p.K2 = roundK(p.K3 - wR_pbwb);
                let wL_pbwb = wR_pbwb + rand(2, 5); p.K1 = roundK(p.K2 - wL_pbwb);
                p.P3 = rand(4, 8);
                p.P1 = rand(0.5, p.P3 - 1.5);
                let minP2_pbwb = (p.P1 + p.P3) / 2 + 0.1;
                let maxP2_pbwb = Math.min(p.P3 - 0.1, ((p.K2 - p.K1) - (p.K3 - p.K2) + p.P1 + p.P3) / 2 - 0.05);
                if(minP2_pbwb >= maxP2_pbwb) { 
                    p.K1 -= 2; 
                    maxP2_pbwb = Math.min(p.P3 - 0.1, ((p.K2 - p.K1) - (p.K3 - p.K2) + p.P1 + p.P3) / 2 - 0.05); 
                }
                p.P2 = rand(minP2_pbwb, maxP2_pbwb);
                break;
            case 'CallBWBBear': 
                p.K1 = roundK(S0 + rand(1, 3)); 
                let wL_cbwb = rand(2, 5); p.K2 = roundK(p.K1 + wL_cbwb);
                let wR_cbwb = wL_cbwb + rand(2, 5); p.K3 = roundK(p.K2 + wR_cbwb);
                p.P1 = rand(4, 8);
                p.P3 = rand(0.5, p.P1 - 1.5);
                let minP2_cbwb = (p.P1 + p.P3) / 2 + 0.1;
                let maxP2_cbwb = Math.min(p.P1 - 0.1, ((p.K3 - p.K2) - (p.K2 - p.K1) + p.P1 + p.P3) / 2 - 0.05);
                if(minP2_cbwb >= maxP2_cbwb) { 
                    p.K3 += 2; 
                    maxP2_cbwb = Math.min(p.P1 - 0.1, ((p.K3 - p.K2) - (p.K2 - p.K1) + p.P1 + p.P3) / 2 - 0.05); 
                }
                p.P2 = rand(minP2_cbwb, maxP2_cbwb);
                break;
            case 'IronCondor': 
                p.K2 = roundK(S0 - em - rand(1, 3)); p.K1 = roundK(p.K2 - rand(4, 8)); 
                p.K3 = roundK(S0 + em + rand(1, 3)); p.K4 = roundK(p.K3 + rand(4, 8)); 
                p.P2 = rand(3, 5); p.P1 = rand(1, p.P2 - 0.5); p.P3 = rand(3, 5); p.P4 = rand(1, p.P3 - 0.5); 
                if ((p.P2 - p.P1 + p.P3 - p.P4) >= Math.min(p.K2-p.K1, p.K4-p.K3)) {
                    p.K1 -= 2; p.K4 += 2;
                }
                break;
            case 'CallButterfly': 
            case 'PutButterfly':
                const w = rand(5, 10); 
                p.K2 = roundK(S0 + rand(-0.5, 0.5)); 
                p.K1 = roundK(p.K2 - w); p.K3 = roundK(p.K2 + w); 
                p.P2 = rand(3, 6); p.P3 = rand(0.5, p.P2 - 1); p.P1 = rand(2 * p.P2 - p.P3 + 0.2, 2 * p.P2 - p.P3 + 3); 
                break;
            case 'JadeLizard': 
                p.K1 = roundK(S0 - em - rand(2, 5)); p.K2 = roundK(S0 + em + rand(0, 3)); 
                p.K3 = roundK(p.K2 + rand(4, 8)); 
                p.P2 = rand(4, 7); p.P3 = rand(1, p.P2 - 0.5); 
                p.P1 = rand(Math.max(0.5, p.K3 - p.K2 - (p.P2 - p.P3)), p.K3 - p.K2 - (p.P2 - p.P3) + 2);
                break;
            case 'Strangle': 
                p.K1 = roundK(S0 - em - rand(2, 6)); p.K2 = roundK(S0 + em + rand(2, 6)); 
                p.P1 = rand(3, 7); p.P2 = rand(3, 7); 
                break;
            default: p.K1 = S0-5; p.K2 = S0+5; p.P1 = 2; p.P2 = 2;
        }

        let validSpread = true;
        if (strategy.includes('Spread') && !strategy.includes('BWB')) { 
            validSpread = (Math.abs(p.P1-p.P2) < Math.abs(p.K1-p.K2));
        }
        let positiveStrikes = Object.keys(p).every(k => !k.startsWith('K') || p[k] >= 0);
        if (validSpread && positiveStrikes) { safetyCheck = true; }
    }
    for (let k in p) { 
        if (k !== 'DTE' && k !== 'IV') p[k] = parseFloat(p[k].toFixed(2)); 
    }

    const lower1SD = S0 - em;
    const upper1SD = S0 + em;

    let logicText = `系統產生了 <b>S0 = $${S0.toFixed(2)}</b>, <b>IV = ${IV.toFixed(2)}%</b>, <b>DTE = ${DTE} 天</b> 的環境，算出的 1 SD 波動區間為 <b>±$${em.toFixed(2)} ($${lower1SD.toFixed(2)} ~ $${upper1SD.toFixed(2)})</b>。<br>`;
    if(strategy.includes('ShortPut') || strategy.includes('IronCondor') || strategy.includes('Strangle') || strategy.includes('BearCallSpread') || strategy.includes('BullPutSpread') || strategy.includes('JadeLizard')) {
        logicText += `💡 為了確保你的收租策略具備高勝率，教練已幫你把「賣出腳」刻意配置在 1 SD 預期暴風圈之外。`;
    } else if (strategy.includes('BullCallSpread') || strategy.includes('BearPutSpread')) {
        logicText += `💡 這是一個買方攻擊策略，教練幫你把買入腳放在現價外 (OTM)，並把賣出腳 (停利點) 設定在 1 SD 區間內，這是一個勝率較高且實際達陣機率大的配置。`;
    } else {
        logicText += `💡 系統已根據波動率配置對應的參數，確保不會因為過度極端或產生無風險套利而導致策略變形。`;
    }

    return { params: p, logicText: logicText };
}

function validateStrategyAndRenderCoach(analysis) {
    const { strategy, S0, IV, DTE, netPremium } = analysis;
    const isAllZero = (S0 === 0);
    const m = document.getElementById('priceMode').value;
    
    const getVal = (id) => parseFloat(document.getElementById(id)?.value || 0);
    const K1 = getVal('K1'); const P1 = getVal('P1');
    const K2 = getVal('K2'); const P2 = getVal('P2');
    const K3 = getVal('K3'); const P3 = getVal('P3');
    const K4 = getVal('K4'); const P4 = getVal('P4');

    let errors = [];
    let errorFields = new Set();
    let warnings = [];

    document.querySelectorAll('.strategy-param input').forEach(el => {
        el.classList.remove('input-valid', 'input-invalid');
    });

    const em = (S0 > 0 && IV > 0 && DTE > 0) ? (S0 * (IV / 100) * Math.sqrt(DTE / 365)) : 0;
    const lower1SD = S0 - em;
    const upper1SD = S0 + em;

    ['K1', 'K2', 'K3', 'K4'].forEach(k => {
        const val = getVal(k);
        const marker = document.getElementById(`sd-${k}`);
        if (marker && em > 0 && val > 0 && !isAllZero) {
            const dist = Math.abs(val - S0) / em;
            marker.style.display = 'inline-block';
            if (dist < 1.0) {
                marker.className = 'sd-marker sd-danger';
                marker.innerHTML = `❗距 ${(dist).toFixed(2)} SD`;
            } else if (dist < 1.5) {
                marker.className = 'sd-marker sd-warn';
                marker.innerHTML = `🟡距 ${(dist).toFixed(2)} SD`;
            } else {
                marker.className = 'sd-marker sd-safe';
                marker.innerHTML = `✅距 ${(dist).toFixed(2)} SD`;
            }
        } else if (marker) {
            marker.style.display = 'none';
        }
    });

    let hasZeroStrike = false;
    let hasAnyStrike = false;
    strategyConfigs[strategy].legs.forEach(leg => {
        if(leg.id.startsWith('K')) {
            if(getVal(leg.id) === 0) hasZeroStrike = true;
            else hasAnyStrike = true;
        }
    });

    if (isAllZero || em === 0) return { status: 'empty' };
    if (!hasAnyStrike || hasZeroStrike) return { status: 'incomplete', lower1SD, upper1SD };

    const addError = (fields, msg) => {
        errors.push(msg);
        fields.forEach(f => errorFields.add(f));
    };

    switch (strategy) {
        case 'ShortPut':
            if (P1 <= 0) addError(['P1'], `必須收取權利金 (P1 > 0)。`);
            if (K1 >= S0) addError(['K1'], `您的賣出腳 (K1) 必須小於現價 (S0)，確保在價外 OTM 建倉。`);
            if (K1 > lower1SD) warnings.push(`賣出腳 (K1) 掉進 1 SD 暴風圈內，勝率堪憂。`);
            break;
        case 'BullPutSpread':
            if (K1 >= K2) addError(['K1', 'K2'], `K1 (買入保險) 必須小於 K2 (賣出收租)。`);
            if (P1 >= P2) addError(['P1', 'P2'], `P1 (較遠價外) 應比 P2 便宜。請確認報價是否填反。`);
            if (netPremium <= 0) addError(['P1', 'P2'], `收支錯誤：應為淨收入 (Credit)，請拓寬 K1 與 K2 價差。`);
            if (K2 >= S0) addError(['K2'], `收租腳 (K2) 應設在現價之下 (OTM)。`);
            if (K2 > lower1SD) warnings.push(`主要收租腳 (K2) 已掉入 1 SD 暴風圈內。`);
            break;
        case 'BearCallSpread':
            if (K1 >= K2) addError(['K1', 'K2'], `K1 (賣出收租) 必須小於 K2 (買入保險)。`);
            if (P1 <= P2) addError(['P1', 'P2'], `P1 (較靠近現價) 應比 P2 貴。`);
            if (netPremium <= 0) addError(['P1', 'P2'], `收支錯誤：應為淨收入 (Credit)。`);
            if (K1 <= S0) addError(['K1'], `收租腳 (K1) 應嚴格大於現價 (OTM)。`);
            if (K1 < upper1SD) warnings.push(`主要收租腳 (K1) 已掉入 1 SD 暴風圈內。`);
            break;
        case 'BearPutSpread':
            if (K1 >= K2) addError(['K1', 'K2'], `K1 (賣出停利) 必須小於 K2 (買入攻擊)。`);
            if (K2 > S0) addError(['K2'], `K2 (買入腳) 必須不大於現價 (S0)，確保在價外或平值。`);
            if (P1 >= P2) addError(['P1', 'P2'], `P1 應該比 P2 便宜。`);
            if (netPremium >= 0) addError(['P1', 'P2'], `此策略應為淨支出 (Debit)。`);
            break;
        case 'BullCallSpread':
            if (K1 >= K2) addError(['K1', 'K2'], `K1 (買入腳) 必須小於 K2 (賣出腳)。`);
            if (K1 < S0) addError(['K1'], `K1 (買入腳) 必須不小於現價 (S0)，確保在價外或平值。`);
            if (P1 <= P2) addError(['P1', 'P2'], `P1 應該比 P2 貴。`);
            if (netPremium >= 0) addError(['P1', 'P2'], `此策略應為淨支出 (Debit)。`);
            break;
        case 'IronCondor':
            if (!(K1 < K2 && K2 < S0 && S0 < K3 && K3 < K4)) addError(['K1', 'K2', 'K3', 'K4'], `履約價必須包圍現價：K1 < K2 < S0 < K3 < K4。`);
            if (P1 >= P2 || P4 >= P3) addError(['P1', 'P2', 'P3', 'P4'], `保險腳必須比收租腳便宜。`);
            if (netPremium <= 0) addError(['P1', 'P2', 'P3', 'P4'], `收支錯誤：應為淨收入 (Credit)。`);
            if (netPremium >= Math.min(K2-K1, K4-K3)) addError(['P1', 'P2', 'P3', 'P4'], `定價錯誤：淨收入不得大於或等於最小翼展，否則產生無風險套利空間！`);
            if (K2 > lower1SD || K3 < upper1SD) warnings.push(`鐵籠區間太窄，已包在 1 SD 暴風圈以內。`);
            break;
        case 'Strangle':
            if (!(K1 < S0 && S0 < K2)) addError(['K1', 'K2'], `賣出腳 (K1, K2) 必須分居現價 (S0) 兩側 (OTM)。`);
            if (P1 <= 0 || P2 <= 0) addError(['P1', 'P2'], `必須收取權利金。`);
            if (K1 > lower1SD || K2 < upper1SD) warnings.push(`雙向裸賣風險極高，您的部位太貼近現價 (1 SD 暴風圈內)。`);
            break;
        case 'CallButterfly':
            if (!(K1 < K2 && K2 < K3)) addError(['K1', 'K2', 'K3'], `履約價順序錯誤：必須為 K1 < K2 < K3。`);
            if (Math.abs((K2-K1) - (K3-K2)) > 0.05) addError(['K1', 'K2', 'K3'], `左右兩翼必須完全等寬。`);
            if (!(P1 > P2 && P2 > P3)) addError(['P1', 'P2', 'P3'], `Call 權利金應符合 P1 > P2 > P3。`);
            if (netPremium >= 0) addError(['P1', 'P2', 'P3'], `此策略應為淨支出 (Debit)。`);
            if (Math.abs(K2 - S0) > em * 0.5) warnings.push(`蝴蝶的身體 (K2) 偏離現價過多，這將導致極低的獲利機率。`);
            break;
        case 'PutButterfly':
            if (!(K1 < K2 && K2 < K3)) addError(['K1', 'K2', 'K3'], `履約價順序錯誤：必須為 K1 < K2 < K3。`);
            if (Math.abs((K2-K1) - (K3-K2)) > 0.05) addError(['K1', 'K2', 'K3'], `左右兩翼必須完全等寬。`);
            if (!(P1 < P2 && P2 < P3)) addError(['P1', 'P2', 'P3'], `Put 權利金應符合 P1 < P2 < P3。`);
            if (netPremium >= 0) addError(['P1', 'P2', 'P3'], `此策略應為淨支出 (Debit)。`);
            if (Math.abs(K2 - S0) > em * 0.5) warnings.push(`蝴蝶的身體 (K2) 偏離現價過多，這將導致極低的獲利機率。`);
            break;
        case 'JadeLizard':
            if (!(K1 < S0 && S0 < K2 && K2 < K3)) addError(['K1', 'K2', 'K3'], `履約價必須符合 K1 < S0 < K2 < K3 (全價外)。`);
            if (P1 <= 0 || P2 <= P3) addError(['P1', 'P2', 'P3'], `權利金邏輯錯誤，請確保 P1 > 0 且 P2 > P3。`);
            if (netPremium < (K3 - K2)) addError(['P1', 'P2', 'P3', 'K2', 'K3'], `嚴重風險：總淨收入必須 ≥ (K3-K2) 寬度，否則上漲會虧損！`);
            if (K1 > lower1SD) warnings.push(`賣出 Put (K1) 防禦空間過小 (在 1 SD 內)。`);
            break;
        case 'PutRatioSpreadBull':
            if (K1 > S0) addError(['K1'], `K1 (買入腳) 必須小於或等於現價 (S0)，確保在價外建倉。`);
            if (K2 >= K1) addError(['K1', 'K2'], `K2 (賣出腳) 必須小於 K1 (買入腳)。`);
            if (P2 >= P1) addError(['P1', 'P2'], `P2 (遠價外) 必須小於 P1 (近現價)。`);
            if (netPremium < 0) addError(['P1', 'P2'], `嚴重錯誤：此策略建倉必須是零成本或淨收入 (Net Credit ≥ 0)。`);
            if (netPremium >= (K1 - K2)) addError(['P1', 'P2'], `定價錯誤：淨收入不得大於或等於翼展 (${(K1-K2).toFixed(2)})，否則存在無風險套利空間！`);
            if (K2 > lower1SD) warnings.push(`您的主要賣出腳 (K2) 距離現價太近，下檔防禦不足。`);
            break;
        case 'PutBWBBull':
            if (K3 > S0) addError(['K3'], `K3 (買入保險) 必須小於或等於現價 (S0)，確保整體位於價外。`);
            if (!(K1 < K2 && K2 < K3)) addError(['K1', 'K2', 'K3'], `順序錯誤：必須 K1 < K2 < K3。`);
            if ((K2-K1) <= (K3-K2)) addError(['K1', 'K2', 'K3'], `左側翼展必須大於右側，否則無法擠出 Credit。`);
            if (P1 >= P2 || P2 >= P3) addError(['P1', 'P2', 'P3'], `權利金應符合 P1 < P2 < P3。`);
            if (netPremium <= 0) addError(['P1', 'P2', 'P3'], `嚴重錯誤：必須為淨收入 (Credit) 才能確保上漲無風險。`);
            if (netPremium >= ((K2 - K1) - (K3 - K2))) addError(['P1', 'P2', 'P3'], `定價錯誤：淨收入不得大於最大可能虧損邊界 (${((K2 - K1) - (K3 - K2)).toFixed(2)})，否則產生無風險套利空間！`);
            if (K2 > lower1SD) warnings.push(`您的主要賣出腳 (K2) 距離現價太近，下檔防禦不足。`);
            break;
        case 'CallBWBBear':
            if (K1 < S0) addError(['K1'], `K1 (買入腳) 必須大於或等於現價 (S0)，確保整體位於價外。`);
            if (!(K1 < K2 && K2 < K3)) addError(['K1', 'K2', 'K3'], `順序錯誤：必須 K1 < K2 < K3。`);
            if ((K3-K2) <= (K2-K1)) addError(['K1', 'K2', 'K3'], `右側翼展必須大於左側，否則無法擠出 Credit。`);
            if (P1 <= P2 || P2 <= P3) addError(['P1', 'P2', 'P3'], `權利金應符合 P1 > P2 > P3。`);
            if (netPremium <= 0) addError(['P1', 'P2', 'P3'], `嚴重錯誤：必須為淨收入 (Credit) 才能確保下跌無風險。`);
            if (netPremium >= ((K3 - K2) - (K2 - K1))) addError(['P1', 'P2', 'P3'], `定價錯誤：淨收入不得大於最大可能虧損邊界 (${((K3 - K2) - (K2 - K1)).toFixed(2)})，否則產生無風險套利空間！`);
            if (K2 < upper1SD) warnings.push(`您的主要賣出腳 (K2) 距離現價太近，上檔防禦不足。`);
            break;
    }

    if (m === 'manual') {
        strategyConfigs[strategy].legs.forEach(leg => {
            let el = document.getElementById(leg.id);
            if (el && el.value !== "") {
                if (errorFields.has(leg.id)) {
                    el.classList.add('input-invalid');
                } else {
                    el.classList.add('input-valid');
                }
            }
        });
    }

    if (errors.length > 0) return { status: 'error', errors };
    if (warnings.length > 0) return { status: 'warning', warnings };
    return { status: 'safe' };
}

function toggleLockEnv() {
    isEnvLocked = document.getElementById('lockEnv').checked;
}

function clearAllInputs() {
    const inputs = document.querySelectorAll('.strategy-param input[type="number"]');
    inputs.forEach(input => {
        input.value = "";
        input.classList.remove('input-valid', 'input-invalid');
    });
    document.querySelectorAll('.sd-marker').forEach(marker => {
        marker.style.display = 'none';
        marker.className = 'sd-marker';
    });
    analyzeSpread();
}

function applySmartAdjust() {
    const s = document.getElementById('strategySelector').value;
    const S0 = parseFloat(document.getElementById('S0').value) || 100;
    const IV = parseFloat(document.getElementById('IV').value) || 20;
    const DTE = parseFloat(document.getElementById('DTE').value) || 30;

    const generated = generateLogicParams(s, S0, IV, DTE);
    const smartParams = generated.params;

    Object.keys(smartParams).forEach(k => {
        const el = document.getElementById(k);
        if (el && k !== 'IV' && k !== 'DTE') {
            el.value = smartParams[k].toFixed(2);
        }
    });
    
    justSmartAdjusted = true;
    analyzeSpread();
}

function analyzeSpread() {
    const strategy = document.getElementById('strategySelector').value;
    const S0 = parseFloat(document.getElementById('S0')?.value) || 0; 
    const IV = parseFloat(document.getElementById('IV')?.value) || 0; 
    const DTE = parseFloat(document.getElementById('DTE')?.value) || 0; 
    const params = { S0, IV, DTE };
    
    const isAllZero = (S0 === 0);

    strategyConfigs[strategy].legs.forEach(leg => { const el = document.getElementById(leg.id); if(el) params[leg.id] = parseFloat(el.value) || 0; });
    
    currentAnalysis = calculatePLData(strategy, params);
    
    const setT = (id, txt) => { const el = document.getElementById(id); if(el) el.textContent = txt; };
    setT('netPremiumDisplay', `${currentAnalysis.netPremium.toFixed(2)}`);
    setT('netPremiumFormulaDisplay', currentAnalysis.netPremiumFormula);
    setT('breakeven', currentAnalysis.breakeven);
    setT('bepFormulaDisplay', currentAnalysis.bepFormula);
    setT('maxProfit', currentAnalysis.maxProfit);
    setT('maxProfitFormulaDisplay', currentAnalysis.maxProfitFormula);
    setT('maxLoss', currentAnalysis.maxLoss);
    setT('maxLossFormulaDisplay', currentAnalysis.maxLossFormula);
    setT('strikeDiffValue', currentAnalysis.sDiffText);
    setT('strikeDiffFormulaDisplay', currentAnalysis.sDiffFormula);
    setT('currentPLDisplay', `$${currentAnalysis.currentPLValue}`);
    setT('currentPLFormulaDisplay', currentAnalysis.currentPLFormula);
    setT('legS0Value', currentAnalysis.S0.toFixed(2));
    setT('legS0PLValue', currentAnalysis.currentPLValue);

    const beps = currentAnalysis.breakeven.match(/[\d.]+/g) || [];
    const validBeps = beps.map(v => parseFloat(v)).filter(v => !isNaN(v));

    if (!isAllZero) {
        let bepStr = "";
        if (validBeps.length === 1) bepStr = `: $${validBeps[0].toFixed(2)}`;
        else if (validBeps.length > 1) bepStr = `: $${validBeps.join(' / $')}`;
        document.getElementById('legBEPText').textContent = bepStr;

        if (IV > 0 && DTE > 0) {
            const em = S0 * (IV / 100) * Math.sqrt(DTE / 365);
            document.getElementById('leg1SDText').textContent = ` ($${(S0 - em).toFixed(2)} ~ $${(S0 + em).toFixed(2)})`;
        } else {
            document.getElementById('leg1SDText').textContent = "";
        }

        let maxPText = currentAnalysis.maxProfit.split(" ")[0];
        let maxLText = currentAnalysis.maxLoss.split(" ")[0];
        document.getElementById('legMaxProfitValue').textContent = maxPText.includes('無限') ? '無限' : '$' + maxPText;
        document.getElementById('legMaxLossValue').textContent = maxLText.includes('無限') ? '無限' : '$' + maxLText;
    } else {
        document.getElementById('legBEPText').textContent = "";
        document.getElementById('leg1SDText').textContent = "";
        document.getElementById('legMaxProfitValue').textContent = "—";
        document.getElementById('legMaxLossValue').textContent = "—";
    }

    if (validBeps.length > 0 && S0 > 0 && !isAllZero) {
        const closestBEP = validBeps.reduce((prev, curr) => Math.abs(curr - S0) < Math.abs(prev - S0) ? curr : prev);
        const distancePercent = (Math.abs(closestBEP - S0) / S0) * 100;
        setT('marginOfSafetyValue', `${distancePercent.toFixed(2)}% (最近 BEP: ${closestBEP})`);
        setT('marginOfSafetyFormulaDisplay', `計算過程：|最近 BEP - S0| ÷ S0 = |${closestBEP} - ${S0.toFixed(2)}| ÷ ${S0.toFixed(2)} = ${distancePercent.toFixed(2)}%`);
    } else {
        setT('marginOfSafetyValue', `—`);
        setT('marginOfSafetyFormulaDisplay', `—`);
    }

    if (S0 > 0 && IV > 0 && DTE > 0 && !isAllZero) {
        const em = S0 * (IV / 100) * Math.sqrt(DTE / 365);
        const lower = S0 - em;
        const upper = S0 + em;
        setT('expectedMoveValue', `±$${em.toFixed(2)} (${lower.toFixed(2)} ~ ${upper.toFixed(2)})`);
        setT('expectedMoveFormulaDisplay', `計算過程：S0 × IV% × √(DTE ÷ 365) = ${S0.toFixed(2)} × ${IV}% × √(${DTE} ÷ 365) = ${em.toFixed(2)}`);
    } else {
        setT('expectedMoveValue', `—`);
        setT('expectedMoveFormulaDisplay', `—`);
    }

    document.getElementById('strikeDiffValue').style.color = '#ffffff';
    document.getElementById('breakeven').style.color = '#ffffff';

    const grayFormulas = [
        'marginOfSafetyFormulaDisplay', 'expectedMoveFormulaDisplay',
        'strikeDiffFormulaDisplay', 'netPremiumFormulaDisplay', 
        'currentPLFormulaDisplay', 'bepFormulaDisplay', 
        'maxProfitFormulaDisplay', 'maxLossFormulaDisplay'
    ];
    grayFormulas.forEach(id => { const el = document.getElementById(id); if(el) el.style.color = '#888888'; });

    const setColorRule = (id, val) => {
        const el = document.getElementById(id);
        if(!el) return;
        if (isAllZero) { el.style.color = '#ffffff'; return; }
        if (val > 0) el.style.color = '#28a745';
        else if (val < 0) el.style.color = '#dc3545';
        else el.style.color = '#ffffff';
    };

    setColorRule('netPremiumDisplay', currentAnalysis.netPremium);
    setColorRule('currentPLDisplay', parseFloat(currentAnalysis.currentPLValue));
    setColorRule('legS0PLValue', parseFloat(currentAnalysis.currentPLValue));

    const setMaxColorRule = (id, valStr, isProfit) => {
        const el = document.getElementById(id);
        if(!el) return;
        if (isAllZero) { el.style.color = '#ffffff'; return; }
        if (valStr.includes('無限')) {
            el.style.color = isProfit ? '#28a745' : '#dc3545';
        } else {
            const val = parseFloat(valStr);
            if (isNaN(val) || val === 0) {
                el.style.color = '#ffffff';
            } else {
                el.style.color = isProfit ? '#28a745' : '#dc3545';
            }
        }
    };
    setMaxColorRule('maxProfit', currentAnalysis.maxProfit, true);
    setMaxColorRule('maxLoss', currentAnalysis.maxLoss, false);

    const coachContainer = document.getElementById('coachPanelContainer');
    const randomContainer = document.getElementById('randomLogicContainer');
    const m = document.getElementById('priceMode').value;
    
    if (m === 'manual') {
        randomContainer.style.display = 'none';
        coachContainer.style.display = 'block';

        const evalResult = validateStrategyAndRenderCoach(currentAnalysis);

        if (evalResult.status === 'empty') {
            coachContainer.innerHTML = `<div class="coach-prompt-box">💡 <b>教練提示：</b><br>請先填寫 <b>標的現價 (S0)、標的 ATM IV %、到期天數 (DTE)</b>，教練才能為您計算出 1 SD 市場預期波動區間喔！</div>`;
        } else if (evalResult.status === 'incomplete') {
            coachContainer.innerHTML = `
                <div class="coach-prompt-box">
                    🎯 <b>教練提示：</b><br>目前的 1 SD 區間為 <b>$${evalResult.lower1SD.toFixed(2)} ~ $${evalResult.upper1SD.toFixed(2)}</b>。<br>不知道履約價該怎麼設定嗎？點擊下方按鈕，教練為您示範一組高勝率的參考配置！
                </div>
                <div class="action-buttons">
                    <button onclick="clearAllInputs()" class="clear-btn">🧹 清除重置</button>
                    <button onclick="applySmartAdjust()" class="smart-adjust-btn">🤖 一鍵帶入實戰參數</button>
                </div>
            `;
        } else if (evalResult.status === 'error') {
            let warnHtml = `<div class="risk-alert-box"><strong>❌ 參數邏輯錯誤：</strong><ul>`;
            evalResult.errors.forEach(w => warnHtml += `<li>${w}</li>`);
            warnHtml += `</ul><div style="margin-top:8px; font-size:0.95em; color:#ccc;">請修正紅框標示的欄位，或讓教練為您重新配置標準參數。</div></div>
            <div class="action-buttons">
                <button onclick="clearAllInputs()" class="clear-btn">🧹 清除重置</button>
                <button onclick="applySmartAdjust()" class="smart-adjust-btn">🤖 智能修復：重新配置標準實戰參數</button>
            </div>`;
            coachContainer.innerHTML = warnHtml;
        } else if (evalResult.status === 'warning') {
            let warnHtml = `<div class="risk-alert-box" style="border-left-color: #ffc107;"><strong>⚠️ 實戰風險警告：</strong><ul>`;
            evalResult.warnings.forEach(w => warnHtml += `<li style="color:#ffc107;">${w}</li>`);
            warnHtml += `</ul><div style="margin-top:8px; font-size:0.95em; color:#ccc;">您可以在真實市場中手動調整，或點擊下方由教練為您修復。</div></div>
            <div class="action-buttons">
                <button onclick="clearAllInputs()" class="clear-btn">🧹 清除重置</button>
                <button onclick="applySmartAdjust()" class="smart-adjust-btn">🤖 智能修復：重新配置標準實戰參數</button>
            </div>`;
            coachContainer.innerHTML = warnHtml;
        } else {
            if (justSmartAdjusted) {
                coachContainer.innerHTML = `
                <div class="smart-adjust-success">✅ <b>智能調整完畢！</b><br>已為您配置符合標準圖形且推移至安全邊界的實戰參數。<br><br>💡 <b>${strategyConfigs[strategy].adjustHint || "請觀察圖表與數值變化，這是在真實市場中提高勝率的標準配置。"}</b></div>
                <div class="action-buttons"><button onclick="clearAllInputs()" class="clear-btn" style="flex: 1;">🧹 清除重置</button></div>`;
                justSmartAdjusted = false;
            } else {
                coachContainer.innerHTML = `
                <div class="smart-adjust-success">✅ <b>教練檢測通過！</b><br>您的配置非常優秀！參數完全符合策略邏輯與防套利風控，這能為您確保高勝率的基礎。</div>
                <div class="action-buttons"><button onclick="clearAllInputs()" class="clear-btn" style="flex: 1;">🧹 清除重置</button></div>`;
            }
        }
    } else if (m === 'random') {
        coachContainer.style.display = 'none';
    }

    const checkBtn = document.getElementById('checkAnswerBtn');
    if (checkBtn && checkBtn.style.display !== 'none') {
        resetQuiz();
    }
    drawChart(currentAnalysis);
}

function updateChartVisibility() { if (currentAnalysis) drawChart(currentAnalysis); }

window.resetChartZoom = function() {
    if (profitChartInstance) {
        profitChartInstance.resetZoom();
    }
};

function drawChart(analysis) {
    const canvas = document.getElementById('profitChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (profitChartInstance) profitChartInstance.destroy();
    
    const showS0 = document.getElementById('ticS0').checked;
    const showBEP = document.getElementById('ticBEP').checked;
    const show1SD = document.getElementById('tic1SD') ? document.getElementById('tic1SD').checked : true;

    const beps = analysis.breakeven.match(/[\d.]+/g) || [];
    const validBeps = beps.map(v => parseFloat(v)).filter(v => !isNaN(v));
    const s0 = parseFloat(analysis.S0);
    const s0Profit = parseFloat(analysis.currentPLValue);

    const isAllZero = (analysis.data.every(d => d.profitAndLoss === 0));

    const strikes = [
        parseFloat(document.getElementById('K1')?.value || 0),
        parseFloat(document.getElementById('K2')?.value || 0),
        parseFloat(document.getElementById('K3')?.value || 0),
        parseFloat(document.getElementById('K4')?.value || 0)
    ].filter(k => k > 0);

    let globalMax = -Infinity;
    let globalMin = Infinity;
    analysis.data.forEach(d => {
        if (d.profitAndLoss > globalMax) globalMax = d.profitAndLoss;
        if (d.profitAndLoss < globalMin) globalMin = d.profitAndLoss;
    });

    let maxProfitPoints = [];
    let maxLossPoints = [];

    if (!isAllZero) {
        analysis.data.forEach(d => {
            if (strikes.some(k => Math.abs(k - d.stockPrice) < 0.02)) {
                if (Math.abs(d.profitAndLoss - globalMax) < 0.02) {
                    if (!maxProfitPoints.some(p => Math.abs(p.x - d.stockPrice) < 0.02)) {
                        maxProfitPoints.push({ x: d.stockPrice, y: d.profitAndLoss });
                    }
                }
                if (Math.abs(d.profitAndLoss - globalMin) < 0.02) {
                    if (!maxLossPoints.some(p => Math.abs(p.x - d.stockPrice) < 0.02)) {
                        maxLossPoints.push({ x: d.stockPrice, y: d.profitAndLoss });
                    }
                }
            }
        });
    }

    profitChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: analysis.data.map(d => d.stockPrice),
            datasets: [
                { 
                    label: '損益曲線 (P&L)', 
                    data: analysis.data.map(d => d.profitAndLoss), 
                    tension: 0, 
                    pointRadius: 0,
                    segment: { borderColor: c => isAllZero ? 'rgba(255, 255, 255, 0.4)' : (c.p0.parsed.y >= 0 ? '#28a745' : '#dc3545') },
                    borderWidth: 2,
                    fill: isAllZero ? false : {
                        target: 'origin',
                        above: 'rgba(40, 167, 69, 0.15)',
                        below: 'rgba(220, 53, 69, 0.15)'
                    }
                },
                {
                    label: `現股 S0: $${s0.toFixed(2)} | 損益: $${s0Profit.toFixed(2)}`,
                    data: showS0 && !isAllZero ? [{x: s0, y: s0Profit}] : [],
                    backgroundColor: '#ffffff',
                    borderColor: '#ffffff',
                    pointRadius: 6,
                    showLine: false
                },
                {
                    label: '損益平衡點 (BEP)',
                    data: showBEP && !isAllZero ? validBeps.map(x => ({x: x, y: 0})) : [],
                    backgroundColor: '#007bff', 
                    borderColor: '#ffffff',
                    borderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    showLine: false
                },
                {
                    label: '最大獲利點',
                    data: maxProfitPoints,
                    backgroundColor: '#28a745',
                    borderColor: '#ffffff',
                    borderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    showLine: false
                },
                {
                    label: '最大損失點',
                    data: maxLossPoints,
                    backgroundColor: '#dc3545',
                    borderColor: '#ffffff',
                    borderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    showLine: false
                }
            ]
        },
        options: { 
            responsive: true, maintainAspectRatio: false,
            layout: { padding: { top: 25, bottom: 25 } },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false,
            },
            onHover: (event, chartElement) => {
                event.native.target.style.cursor = chartElement.length ? 'crosshair' : 'default';
            },
            plugins: { 
                legend: { display: false },
                zoom: {
                    pan: { enabled: true, mode: 'xy' },
                    zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' }
                },
                tooltip: {
                    filter: function(tooltipItem) {
                        return tooltipItem.datasetIndex === 0;
                    },
                    callbacks: {
                        label: function(context) {
                            let price = context.parsed.x;
                            let pnl = context.parsed.y;
                            
                            if (maxProfitPoints.some(p => Math.abs(p.x - price) < 0.02)) {
                                return `最大獲利點: $${price.toFixed(2)} | 損益: $${pnl.toFixed(2)}`;
                            }
                            if (maxLossPoints.some(p => Math.abs(p.x - price) < 0.02)) {
                                return `最大損失點: $${price.toFixed(2)} | 損益: $${pnl.toFixed(2)}`;
                            }
                            if (showBEP && validBeps.some(bep => Math.abs(price - bep) < 0.02)) {
                                return `損益平衡點 (BEP): $${price.toFixed(2)} | 損益: $${pnl.toFixed(2)}`;
                            }
                            if (showS0 && Math.abs(price - s0) < 0.02) {
                                return `現股 S0: $${price.toFixed(2)} | 損益: $${pnl.toFixed(2)}`;
                            }
                            return `價格: $${price.toFixed(2)} | 損益: $${pnl.toFixed(2)}`;
                        }
                    },
                    backgroundColor: function(context) {
                        if (context.tooltip && context.tooltip.dataPoints && context.tooltip.dataPoints.length > 0) {
                            let price = context.tooltip.dataPoints[0].parsed.x;
                            if (maxProfitPoints.some(p => Math.abs(p.x - price) < 0.02)) return '#28a745';
                            if (maxLossPoints.some(p => Math.abs(p.x - price) < 0.02)) return '#dc3545';
                        }
                        return 'rgba(0, 0, 0, 0.8)';
                    }
                }
            }, 
            scales: { 
                x: { 
                    type: 'linear', 
                    grid: { color: '#333' }, 
                    title: { display: true, text: '價格 ($)', color: '#ccc' }, 
                    ticks: { 
                        color: '#aaa', 
                        maxTicksLimit: 8,
                        callback: function(value) {
                            return Number(value).toFixed(2);
                        }
                    } 
                }, 
                y: { 
                    grid: { 
                        color: c => c.tick.value === 0 ? 'rgba(255, 255, 255, 0.6)' : '#444', 
                        lineWidth: c => c.tick.value === 0 ? 2 : 1 
                    }, 
                    title: { display: true, text: '損益 ($)', color: '#ccc' }, 
                    ticks: { color: '#aaa' } 
                } 
            } 
        },
        plugins: [{
            id: 'chartDecorations',
            beforeDraw: (chart) => {
                if (isAllZero) return;
                const { ctx, chartArea: { top, bottom, left, right } } = chart;
                ctx.save();
                
                const strategyName = strategyConfigs[analysis.strategy].name;
                const fontSize = Math.min(45, (right - left) / 10);
                
                ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
                ctx.font = `bold ${fontSize}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(strategyName, (left + right) / 2, (top + bottom) / 2);
                ctx.restore();
            },
            beforeDatasetsDraw: (chart) => {
                if (!show1SD || analysis.S0 <= 0 || analysis.IV <= 0 || analysis.DTE <= 0 || isAllZero) return;
                const {ctx, scales: {x, y}, chartArea: {top, bottom}} = chart;
                ctx.save();
                
                const em = analysis.S0 * (analysis.IV / 100) * Math.sqrt(analysis.DTE / 365);
                const xLeft = x.getPixelForValue(analysis.S0 - em);
                const xRight = x.getPixelForValue(analysis.S0 + em);
                
                ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
                ctx.fillRect(xLeft, top, xRight - xLeft, bottom - top);

                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(xLeft, top); ctx.lineTo(xLeft, bottom);
                ctx.moveTo(xRight, top); ctx.lineTo(xRight, bottom);
                ctx.stroke();
                ctx.setLineDash([]);
                
                ctx.fillStyle = 'rgba(255,255,255,0.4)';
                ctx.font = '11px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('1 SD', xLeft, top + 15);
                ctx.fillText('1 SD', xRight, top + 15);

                ctx.restore();
            },
            afterDraw: (chart) => {
                if (!showBEP || isAllZero) return;
                const {ctx, scales: {x, y}} = chart;
                ctx.save();
                
                const yZero = y.getPixelForValue(0);
                
                validBeps.forEach(val => {
                    const xPos = x.getPixelForValue(val);
                    if(xPos >= x.left && xPos <= x.right) {
                        ctx.fillStyle = '#ffffff';
                        ctx.font = 'normal 12px Arial';
                        ctx.textAlign = 'center';
                        ctx.fillText(val.toFixed(2), xPos, yZero - 12);
                    }
                });
                ctx.restore();
            }
        }]
    });
}

// ================= 版面切換邏輯 (全新修改) =================
function toggleLayout() {
    const container = document.querySelector('.container');
    // 以 992px 為電腦/手機版界線
    const isMobileView = window.innerWidth <= 992; 

    if (isMobileView) {
        // 目前為小螢幕 (預設是直式)
        if (container.classList.contains('force-horizontal')) {
            container.classList.remove('force-horizontal'); // 切回直式
        } else {
            container.classList.add('force-horizontal');    // 強制橫式
            container.classList.remove('force-vertical');
        }
    } else {
        // 目前為大螢幕 (預設是橫式)
        if (container.classList.contains('force-vertical')) {
            container.classList.remove('force-vertical');   // 切回橫式
        } else {
            container.classList.add('force-vertical');      // 強制直式
            container.classList.remove('force-horizontal');
        }
    }

    if (profitChartInstance) {
        setTimeout(() => { profitChartInstance.resize(); }, 100);
    }
}

// 監聽視窗大小改變，確保圖表自動適應，並在跨越裝置斷點時重繪圖表
window.addEventListener('resize', () => {
    if (profitChartInstance) {
        profitChartInstance.resize();
    }
});
// =======================================================

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        const successful = document.execCommand('copy');
        if (successful) showCopySuccess();
    } catch (err) {
        console.error('Fallback copy error', err);
    }
    document.body.removeChild(textArea);
}

function copyStrategySummary() {
    const s = document.getElementById('strategySelector');
    const strategyName = s.options[s.selectedIndex].text;
    const s0 = document.getElementById('S0').value;
    const iv = document.getElementById('IV').value;
    const dte = document.getElementById('DTE').value;
    
    let legsText = "";
    const inputs = document.querySelectorAll('.strategy-param .input-group');
    inputs.forEach(group => {
        const label = group.querySelector('label').innerText.replace(/<[^>]*>?/gm, '').replace(':', '').trim();
        const val = group.querySelector('input').value;
        legsText += `- ${label}: ${val}\n`;
    });

    const summary = `【選擇權策略測試分析】
策略：${strategyName}
標的現價 (S0)：$${s0}
平值隱含波動率 (ATM IV)：${iv}% | 到期天數 (DTE)：${dte}天

[建倉參數]
${legsText}
[分析結果]
淨收支 (Net Premium)：${document.getElementById('netPremiumDisplay').innerText}
損益平衡點 (BEP)：${document.getElementById('breakeven').innerText}
最大獲利：${document.getElementById('maxProfit').innerText}
最大損失：${document.getElementById('maxLoss').innerText}
安全邊際：${document.getElementById('marginOfSafetyValue').innerText}
預期波動 (1 SD)：${document.getElementById('expectedMoveValue').innerText}`;

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(summary).then(showCopySuccess).catch(() => {
            fallbackCopyTextToClipboard(summary);
        });
    } else {
        fallbackCopyTextToClipboard(summary);
    }
}

function showCopySuccess() {
    const btn = document.getElementById('copyStrategyBtn');
    const orig = btn.innerText;
    btn.innerText = "✅ 複製成功！";
    btn.style.backgroundColor = "#28a745";
    setTimeout(() => {
        btn.innerText = orig;
        btn.style.backgroundColor = "";
    }, 2000);
}

function onStrategyChange() { 
    const m = document.getElementById('priceMode').value; 
    if (m === 'manual') {
        const S0 = parseFloat(document.getElementById('S0')?.value) || 0;
        const IV = parseFloat(document.getElementById('IV')?.value) || 0;
        const DTE = parseFloat(document.getElementById('DTE')?.value) || 0;
        updateInputs(S0, IV, DTE, true); 
    } else {
        updateInputs(); 
    }
    resetQuiz(); 
}

function resetQuiz() { 
    document.getElementById('quizQuestion').textContent = "請點擊生成題目。"; 
    document.getElementById('quizOptions').innerHTML = ""; 
    
    document.getElementById('generateQuizBtn').style.display = 'block';
    
    const checkBtn = document.getElementById('checkAnswerBtn');
    checkBtn.style.display = 'none'; 
    checkBtn.textContent = "提交答案";
    checkBtn.style.backgroundColor = "#28a745";
    checkBtn.style.color = "#ffffff";
    
    document.getElementById('refreshQuizBtn').style.display = 'none';
    document.getElementById('endQuizBtn').style.display = 'none';
    document.getElementById('quizFeedback').textContent = ""; 
    lastQuestionType = "";
}

function togglePriceMode() { 
    const m = document.getElementById('priceMode').value; 
    document.getElementById('randomRefreshBtn').style.display = (m === 'random') ? 'block' : 'none'; 
    
    const chartBtn = document.getElementById('chartRefreshBtn');
    if (chartBtn) chartBtn.style.display = (m === 'random') ? 'block' : 'none';
    
    if (m === 'random') {
        randomRefresh(); 
    } else {
        updateInputs(0, 0, 0); 
    }
}

function updateInputs(overrideS0 = null, overrideIV = null, overrideDTE = null, keepCurrentManual = false) { 
    const s = document.getElementById('strategySelector').value; 
    const m = document.getElementById('priceMode').value; 
    
    let S0 = 100, IV = 20, DTE = 30;

    if (document.getElementById('S0')) S0 = parseFloat(document.getElementById('S0').value) || 0;
    if (document.getElementById('IV')) IV = parseFloat(document.getElementById('IV').value) || 0;
    if (document.getElementById('DTE')) DTE = parseFloat(document.getElementById('DTE').value) || 0;
    
    if (overrideS0 !== null) { 
        S0 = Number(overrideS0) || 0; 
        IV = Number(overrideIV) || 0; 
        DTE = Number(overrideDTE) || 0; 
    } 
    else {
        if (m === 'manual' && !keepCurrentManual && !isEnvLocked) {
            S0 = 0; IV = 0; DTE = 0;
        }
    }

    const c = document.getElementById('dynamicInputs'); 
    c.innerHTML = ''; 
    const config = strategyConfigs[s]; 

    const descDiv = document.createElement('div');
    descDiv.style.textAlign = 'justify';
    descDiv.style.lineHeight = '1.6';
    descDiv.style.padding = '10px';
    descDiv.style.marginBottom = '15px';
    let bgColor = 'rgba(108, 117, 125, 0.8)'; 
    let borderLeftColor = '#5a6268';
    if (config.desc.includes('偏空')) { bgColor = 'rgba(220, 53, 69, 0.8)'; borderLeftColor = '#c82333'; } 
    else if (config.desc.includes('偏多') && !config.desc.includes('中立')) { bgColor = 'rgba(40, 167, 69, 0.8)'; borderLeftColor = '#218838'; } 
    else if (config.desc.includes('中立')) { bgColor = 'rgba(23, 162, 184, 0.8)'; borderLeftColor = '#138496'; }
    
    descDiv.style.backgroundColor = bgColor;
    descDiv.style.borderLeft = `4px solid ${borderLeftColor}`;
    descDiv.style.color = '#ffffff'; 
    descDiv.style.fontSize = '14px';
    descDiv.style.borderRadius = '0 4px 4px 0';
    descDiv.innerHTML = `💡 <strong>策略方向：</strong>${config.desc}`;
    c.appendChild(descDiv);

    const modalBtn = document.createElement('button');
    modalBtn.className = 'open-greeks-btn';
    modalBtn.innerHTML = '📖 希臘字母與各腳參數實戰指南';
    modalBtn.onclick = openGreeksModal;
    c.appendChild(modalBtn);

    const envGroup = document.createElement('div');
    envGroup.className = 'env-params-grid';
    const dis = m === 'random' ? 'disabled class="random-mode"' : '';
    envGroup.innerHTML = `
        <div class="input-group" style="margin-bottom:0;"><label>標的現價 (S0):</label><input type="number" id="S0" value="${S0 > 0 ? S0.toFixed(2) : ''}" step="0.01" oninput="analyzeSpread()" ${dis}></div>
        <div class="input-group" style="margin-bottom:0;"><label>標的 ATM IV %:</label><input type="number" id="IV" value="${IV > 0 ? IV.toFixed(2) : ''}" step="0.1" oninput="analyzeSpread()" ${dis}></div>
        <div class="input-group" style="margin-bottom:0;"><label>到期天數 (DTE):</label><input type="number" id="DTE" value="${DTE > 0 ? Math.floor(DTE) : ''}" step="1" oninput="analyzeSpread()" ${dis}></div>
    `;
    c.appendChild(envGroup);

    if (m === 'manual') {
        const lockDiv = document.createElement('div');
        lockDiv.style.marginBottom = '15px';
        lockDiv.innerHTML = `<label style="cursor:pointer; display:flex; align-items:center; gap:8px;"><input type="checkbox" id="lockEnv" ${isEnvLocked ? 'checked' : ''} onchange="toggleLockEnv()" style="width:auto; margin:0;"> 🔒 鎖定環境參數 (切換策略時保留 S0, IV, DTE)</label>`;
        c.appendChild(lockDiv);
    }

    const grid = document.createElement('div'); 
    grid.className = 'strategy-param'; 
    
    let generated;
    let randP = {};
    if (m === 'random') {
        generated = generateLogicParams(s, S0, IV, DTE);
        randP = generated.params;
        
        const randomContainer = document.getElementById('randomLogicContainer');
        randomContainer.innerHTML = `<div class="random-logic-box">${generated.logicText}</div>`;
        randomContainer.style.display = 'block';
    } else {
        document.getElementById('randomLogicContainer').style.display = 'none';
    }
    
    config.legs.forEach(leg => { 
        const div = document.createElement('div'); 
        div.className = 'input-group'; 
        const val = (m === 'random') ? randP[leg.id].toFixed(2) : ""; 
        const sdSpan = leg.id.startsWith('K') ? `<span id="sd-${leg.id}" class="sd-marker" style="display:none;"></span>` : '';
        div.innerHTML = `<label>${leg.label} ${sdSpan}:</label><input type="number" id="${leg.id}" value="${val}" step="0.01" oninput="analyzeSpread()" ${m==='random'?'disabled class="random-mode"':''}>`; 
        grid.appendChild(div); 
    }); 
    c.appendChild(grid); 
    
    analyzeSpread(); 
}

function openGreeksModal() {
    const s = document.getElementById('strategySelector').value;
    const config = strategyConfigs[s];
    document.getElementById('greeksModalTitle').innerText = `${config.name} 實戰指南`;
    document.getElementById('greeksModalBody').innerHTML = config.greekGuide;
    document.getElementById('greeksModal').classList.add('active');
}

function closeGreeksModal() {
    document.getElementById('greeksModal').classList.remove('active');
}

function randomRefresh() { 
    const newS0 = rand(65.00, 160.00); 
    const newIV = rand(15, 60);
    const newDTE = Math.floor(rand(7, 60));
    updateInputs(newS0, newIV, newDTE); 
}

function generateQuiz() { 
    if (!currentAnalysis) return; 
    
    const types = ['netPremium', 'currentPL', 'maxProfit', 'maxLoss', 'breakeven']; 
    const availableTypes = types.filter(t => t !== lastQuestionType);
    const type = availableTypes[Math.floor(Math.random() * availableTypes.length)]; 
    lastQuestionType = type;

    let qText = "", cValRaw = ""; 
    
    if(type === 'netPremium') {
        qText = `測驗：此策略當下設定的【淨收支 (Net Premium)】數值為？`;
        cValRaw = currentAnalysis.netPremium.toFixed(2);
    } else if(type === 'currentPL') {
        qText = `測驗：此策略當下的【現有股價損益 (S0 P/L)】數值為？`;
        cValRaw = currentAnalysis.currentPLValue;
    } else if(type === 'maxProfit') { 
        qText = `測驗：此策略當下設定的【最大獲利 (Max Profit)】數值為？`; 
        cValRaw = currentAnalysis.maxProfit; 
    } else if(type === 'maxLoss') { 
        qText = `測驗：此策略當下設定的【最大損失 (Max Loss)】數值為？`; 
        cValRaw = currentAnalysis.maxLoss; 
    } else { 
        qText = `測驗：此策略當下設定的【損益平衡點 (B.E.P.)】位在？`; 
        cValRaw = currentAnalysis.breakeven; 
    } 
    
    let cVal = "";
    if (type === 'breakeven') {
        cVal = cValRaw; 
    } else if (type === 'netPremium' || type === 'currentPL') {
        cVal = cValRaw;
    } else {
        cVal = cValRaw.split(" ")[0]; 
    }

    currentAnswer = cVal; 
    document.getElementById('quizQuestion').textContent = qText; 
    
    let opts = [cVal]; 
    while(opts.length < 4) { 
        let f = "";
        if (cVal === "無限") {
            f = (parseFloat(currentAnalysis.netPremium) + rand(10, 80)).toFixed(2);
        } else if (cVal.includes("/")) {
            let parts = cVal.match(/[\d.]+/g);
            if(parts && parts.length === 2) {
                let diff1 = rand(1, 5).toFixed(2);
                let diff2 = rand(1, 5).toFixed(2);
                f = `${(parseFloat(parts[0]) - diff1).toFixed(2)} / ${(parseFloat(parts[1]) + parseFloat(diff2)).toFixed(2)}`;
            } else {
                f = (parseFloat(cVal) + rand(-15, 15)).toFixed(2);
            }
        } else {
            f = (parseFloat(cVal) + rand(-15, 15)).toFixed(2); 
        }
        if(!opts.includes(f) && !isNaN(parseFloat(f.split(" ")[0]))) opts.push(f); 
    } 
    opts.sort(() => Math.random() - 0.5); 
    
    document.getElementById('quizOptions').innerHTML = opts.map((opt, i) => `<div style="margin:5px 0;"><input type="radio" name="quiz" id="o${i}" value="${opt}"><label for="o${i}" style="display:inline-block; margin-left:8px; cursor:pointer;">${String.fromCharCode(65+i)}. ${opt}</label></div>`).join(''); 
    
    document.getElementById('generateQuizBtn').style.display = 'none';
    
    const checkBtn = document.getElementById('checkAnswerBtn');
    checkBtn.style.display = 'block'; 
    checkBtn.textContent = "提交答案";
    checkBtn.style.backgroundColor = "#28a745";
    checkBtn.style.color = "#ffffff";
    
    document.getElementById('refreshQuizBtn').style.display = 'block';
    document.getElementById('endQuizBtn').style.display = 'block';
    document.getElementById('quizFeedback').textContent = ""; 
}

function checkAnswer() { 
    const btn = document.getElementById('checkAnswerBtn');
    
    if (btn.textContent === "答對了，繼續下一題") {
        generateQuiz();
        return;
    }

    const s = document.querySelector('input[name="quiz"]:checked'); 
    if(!s) return alert("請選擇答案！"); 
    
    const f = document.getElementById('quizFeedback'); 
    if(s.value == currentAnswer) { 
        f.textContent = "正確！"; 
        f.style.color = "#28a745"; 
        btn.textContent = "答對了，繼續下一題";
        btn.style.backgroundColor = "#ffc107";
        btn.style.color = "#121212";
    } else { 
        f.textContent = `錯誤，正確答案是 ${currentAnswer}`; 
        f.style.color = "#dc3545"; 
        btn.textContent = "重新提交答案";
        btn.style.backgroundColor = "#28a745";
        btn.style.color = "#ffffff";
    } 
}

window.onload = () => { togglePriceMode(); };