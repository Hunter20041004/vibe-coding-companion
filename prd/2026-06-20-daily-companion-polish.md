---
status: draft
created: 2026-06-20
---

# PRD: Daily Companion Polish

## Why / Background

Vibe Coding Companion 已經從早期的 Web prototype，推進到本機 companion runtime：有 Companion Console、本機事件伺服器、Codex 與 Claude Code hook adapter、Electron desktop overlay、Prompt Coach、Session summary、Skill hint、Next Step advice、可選 AI decision 與一次性 Vision context。

目前的主要問題不是缺少「更多 AI 功能」，而是產品感還偏開發工具。陌生使用者第一次打開時，容易先看到 setup、狀態、權限、hook、log、校準等資訊，而不是先感受到「有一個 companion 正在陪我 coding」。若要把這個專案往可售產品推進，第一步應先讓產品本身變得可日用、可理解、有角色記憶點，商店、付費、角色包匯入、授權驗證等商業化機制則先延後。

決策者視角：這份 PRD 的目標是建立「可被陌生使用者完成第一次到日用」的產品底座。範圍鎖定 macOS、Codex、Claude Code，因為現有 runtime、hook adapter、overlay、prompt watcher 與 Accessibility 診斷都已圍繞這個組合成形。第一版不擴張到 Cursor、Windsurf、內建商店、帳號同步或付費授權，以免在核心體驗尚未穩定前就背上平台與營運複雜度。

使用者視角：使用者想要的是一個低干擾、有個性、能讓 agent 工作狀態變得可感知的電子夥伴。他們不應該需要先讀 README 才知道下一步，也不應該在 hook 或 macOS 權限失敗時只看到抽象錯誤。第一次使用時，使用者要能看到 companion、完成必要 readiness、切換內建角色、輸入 prompt draft 並得到角色化 Next Step，最後用 hook 測試事件確認 overlay 真的會反應。

## Solution

本次改版會把現有 Companion Console 打磨成角色優先的單頁 Hero Companion Dashboard。使用者一打開主畫面，第一眼看到的是目前 companion、狀態、speech bubble 與最值得做的下一步，而不是服務監控台。Dashboard 仍保留完整 readiness 與 diagnostics，但資訊層級會從「debug cockpit」改成「日用產品」：日常區先呈現 companion 與工作建議，診斷區預設收斂，只有在需要修復時才被帶出來。

Dashboard 會內建 guided readiness，不做獨立 wizard。第一次使用時，Companion Stage 仍然顯示角色，但旁邊會溫和指出目前還差哪些步驟，例如 Server、Overlay、Codex hooks、Claude Code hooks、macOS permissions、AI key optional、Prompt watcher。每個 readiness 項目都要提供目前狀態、為什麼重要、可執行的修復動作、重新檢查與跳過後的影響。

產品會內建 3 個主題角色：宇宙水母、奶泡幽靈、綠磷光像素怪。三個角色共用現有 companion runtime、event model、placement policy 與 coaching core，但會有明顯不同的 silhouette、主題色、bubble 樣式、文案語氣與輕量 coaching 偏好。角色差異不只是換名稱或顏色；使用者切換角色後，要感覺 companion 的外觀與提醒方式都不同。

Prompt Coach 與 Next Step 會採用「同一建議核心，加上角色化呈現」的模式。底層建議仍由現有規則與事件脈絡產生；角色 profile 只調整語氣、提醒頻率與同優先建議的排序偏好，不允許捏造工作訊號、不允許把低優先提醒升成高優先，也不允許把可選 AI key 包裝成必要步驟。

## User Stories & Scenarios

**Scenario 1：第一次打開 Hero Companion Dashboard**

- Given 一位「第一次使用 Vibe Coding Companion 的 macOS 使用者」
- When 打開產品主畫面
- Then 使用者會先看到目前 companion、狀態 bubble、Next Step 與 guided readiness，而不是只看到 setup 表單或 debug panel
- So that 使用者能在不讀 README 的情況下理解這是一個正在陪伴 coding 工作的 companion

**Scenario 2：guided readiness 顯示下一個設定步驟**

- Given 一位「尚未完成本機 readiness 的使用者」
- When Server、Overlay、Codex hooks、Claude Code hooks、Permissions 或 Prompt watcher 任一項尚未就緒
- Then Dashboard 會顯示該項狀態、缺少什麼、為什麼重要、可執行的修復動作、重新檢查與跳過後影響
- So that 使用者不需要從錯誤訊息或 README 反推下一步

**Scenario 3：AI key 是可選增強**

- Given 一位「沒有設定 AI key 的使用者」
- When 使用者完成其他 readiness 項目
- Then Dashboard 仍允許完成核心流程，並明確標示 AI key 只影響 Vision context 與 optional AI decision
- So that 使用者不會因為沒有 Google AI Studio key 而被擋在第一次體驗外

**Scenario 4：切換內建角色**

- Given 一位「已進入 Dashboard 的使用者」
- When 在 Characters 區塊啟用宇宙水母、奶泡幽靈或綠磷光像素怪
- Then Companion Stage、speech bubble、Prompt Coach 呈現與 overlay 都會套用同一個 active character
- So that 使用者能感覺自己換了一個 companion，而不是只改了一個設定值

**Scenario 5：角色切換後重新整理仍保留**

- Given 一位「已選擇內建角色的使用者」
- When 重新整理 Dashboard 或重新啟動 companion services
- Then 系統會還原上次的 active character；若設定資料失效，則安全回到預設角色
- So that 使用者不需要每天重新選擇 companion

**Scenario 6：Prompt Coach 產生角色化 Next Step**

- Given 一位「正在撰寫 prompt draft 的使用者」
- When 在 Prompt Coach 輸入足夠長且可判斷的 draft
- Then 系統會產生 Next Step，並依 active character 調整語氣與呈現方式，但保留原本建議的 priority、skill 與 reason 核心含義
- So that 使用者得到的是有個性的工作提醒，而不是三個角色各自亂給不同品質的建議

**Scenario 7：宇宙水母偏向冷靜導航**

- Given 一位「使用宇宙水母的使用者」
- When Prompt Coach 或本機事件產生多個同優先建議
- Then Dashboard 會偏向呈現 scope、下一步、拆小任務等導航型建議，語氣冷靜且有方向感
- So that 複雜工作狀態能被整理成比較穩的下一步

**Scenario 8：奶泡幽靈偏向溫和陪伴**

- Given 一位「使用奶泡幽靈的使用者」
- When readiness 未完成、prompt draft 太寬，或 prompt watcher 因權限限制無法讀取文字欄位
- Then Dashboard 會用溫和語氣說明可修復動作與 fallback，例如改用 Dashboard Prompt Coach textarea
- So that 產品在失敗或未完成狀態下仍保有陪伴感，而不是變成冷冰冰的錯誤面板

**Scenario 9：綠磷光像素怪偏向測試與命令列節奏**

- Given 一位「使用綠磷光像素怪的使用者」
- When 系統偵測到 bug、failed test、缺少驗證方式或測試事件
- Then Dashboard 會偏向呈現測試、最小重現、命令列式短句提醒
- So that 使用者在 debug 工作中能快速看到可執行的下一步

**Scenario 10：hook 測試事件驅動 overlay**

- Given 一位「已安裝或測試 Codex／Claude Code hooks 的使用者」
- When 使用 Dashboard 發出 hook 測試事件
- Then 本機事件伺服器會收到事件，Dashboard work state 會更新，desktop overlay 也會出現對應狀態反應
- So that 使用者能確認最重要的本機事件管線真的打通

**Scenario 11：hook 或 permission 失敗時仍可使用核心功能**

- Given 一位「尚未完成 hooks 或 macOS Accessibility permission 的使用者」
- When 嘗試使用 Dashboard
- Then 使用者仍可切換角色、使用 Prompt Coach textarea、送 demo/test event，並看到明確修復或跳過說明
- So that 失敗項目不會讓整個產品看起來不可用

**Scenario 12：Diagnostics 預設不干擾日常畫面**

- Given 一位「日常使用者」
- When 沒有正在修復 readiness 或排查問題
- Then Diagnostics 會收斂在 Dashboard 底部，保留 placement、foreground app、no-fly region、logs、hook test、event stream 等資訊，但不搶 Companion Stage 的視覺重心
- So that 產品保留可支援性，同時不像服務監控台

**Scenario 13：資料與隱私提示清楚**

- Given 一位「擔心 prompt 或畫面資料外流的使用者」
- When 使用 Prompt Coach、Prompt watcher 或 Vision context 相關功能
- Then Dashboard 會清楚說明短草稿何時會被忽略、raw prompt 不應保存在 event stream、Vision context 是使用者批准的一次性分析、AI key 是可選增強
- So that 使用者能理解產品讀取與處理資料的邊界

## Implementation Decisions

- **Hero Companion Dashboard**：取代現有偏 setup 的 Console 呈現，成為單頁產品主畫面。主要區塊順序為 Companion Stage、Next Step、Characters、Prompt Coach、Guided Readiness、Diagnostics。
- **Companion Stage**：負責呈現 active character、目前 work state、speech bubble、簡短狀態與 first-run readiness 提示。它是日常主視覺，不承擔完整診斷資訊。
- **Characters**：負責呈現 3 個內建角色、角色預覽、主題標籤、coaching 偏好與啟用動作。角色切換後要同步影響 Dashboard 與 overlay。
- **Character Profile**：新增一個穩定模型，描述角色 identity、theme、silhouette、voice、coaching bias 與 overlay behavior。第一版只支援內建 profile，不支援外部 pack。
- **Characterized Advice**：接收中性的 Prompt Coach 或 Next Step core advice，輸出角色化 presentation。它可以改寫短句、調整語氣、調整同優先建議排序與提醒頻率，但不能改變事實、priority、skill、reason 的核心含義。
- **Preference Store**：保存 active character。設定有效時重啟後還原；設定遺失或不合法時回到預設角色。
- **Guided Readiness**：彙整 Server、Overlay、Permissions、Codex hooks、Claude Code hooks、AI key optional、Prompt watcher 狀態。每個項目都要有狀態、原因、修復動作、重新檢查與跳過說明。
- **Diagnostics**：保留現有日用排錯能力，但預設收斂。Readiness 發現問題時可以 deep-link 或展開對應診斷資訊。
- **Hook Test Flow**：提供可從 Dashboard 觸發的 Codex／Claude Code 測試事件，用於驗證 event server、Dashboard state 與 overlay reaction 之間的管線。
- **Prompt Coach Privacy Guardrail**：短草稿仍應被忽略；可產生建議的 draft 不應以 raw prompt 形式保存在 event stream。Dashboard 要用產品文案說清楚這個邊界。
- **AI Optional Contract**：AI key 不得成為完成 onboarding 或 daily flow 的必要條件。沒有 AI key 時，deterministic companion、Prompt Coach 與 hook-driven overlay 仍需可用。

## Testing Decisions

本專案採用 TDD（Test-Driven Development）方式開發，TDD 是任何開發工作的最高原則，不可省略。後續 implementation plan 也必須清楚寫出 Red → Green → Refactor 的垂直切片；若計畫只寫「先列所有測試，再做所有實作」，該計畫應被拒絕。

**TDD 核心循環**

1. **Red**：先寫一個失敗測試，描述一個可觀察的新行為或修正。
2. **Green**：只寫最少量程式碼讓該測試通過，不預先實作後續功能。
3. **Refactor**：在測試保護下整理命名、消除重複、深化模組邊界，並確認測試仍然全綠。

一次只允許寫一個失敗測試，通過後再寫下一個。開發順序必須採垂直切片：

- WRONG（水平）：RED：t1、t2、t3 → GREEN：i1、i2、i3。
- RIGHT（垂直）：t1 → i1 → refactor → t2 → i2 → refactor → t3 → i3 → refactor。

Plan mode 也必須遵守同樣粒度：每個切片先列測試修改或新增，再列該測試對應的最小實作與 refactor 檢查，不可把測試清單與實作清單分成兩個大型階段。

**新功能開發規則**

- 先寫測試描述預期使用者行為或模組對外契約，確認紅燈。
- 實作最小程式碼，確認綠燈。
- 重構並確認測試仍全綠。

**修改既有程式碼規則**

- 先檢查要修改的既有行為是否已有測試保護；若沒有，先補一個保護既有行為的測試。
- 修改或新增一個測試，描述新的預期行為，確認紅燈。
- 修改程式碼讓測試通過，確認綠燈。
- 重構並確認測試仍全綠。

**Bug fix 規則**

- 先寫一個能重現 bug 的測試，確認紅燈。
- 修復 bug，確認綠燈。
- 重構並確認測試仍全綠。

測試以可觀察行為為主，不測角色 silhouette 的每個像素，也不直接測 UI 內部實作細節。這個專案既有測試已涵蓋 event server、local server、overlay、Prompt Coach、Skill recommender、setup shell、Playwright E2E 等方向；本次改版應延續同樣風格。

測試粒度原則：

- 應測試：元件互動、函式與模組的對外行為、hook 行為、重要錯誤處理、readiness 修復路徑、角色化 advice 契約、核心使用者流程。
- 不需要測試：純靜態文字是否出現在某個位置、CSS 實作細節、canvas 每個像素的低階繪圖細節。
- 最大原則：確保使用者操作流程與本機事件管線不會出錯。

測試失敗時，必須先判斷是產品程式碼、測試假設，還是真實邊界契約有問題，不可盲目修改測試讓它通過。若遇到非本次修改造成的既有測試失敗，implementation plan 或完成回報必須列出失敗測試、觀察到的錯誤與建議處理方式。

需要新增或調整的測試範圍：

- **Character Profile tests**：驗證 3 個內建角色 metadata、預設角色、非法 active character fallback、profile 不允許影響錯誤事實或 readiness 狀態。
- **Characterized Advice tests**：同一個 core advice 經不同角色處理後，語氣與排序可以不同，但 priority、skill、reason 的核心含義不能被竄改。
- **Preference tests**：驗證 active character 保存、還原、資料失效 fallback。
- **Dashboard shell tests**：驗證單頁 Dashboard 的主要區塊順序與 first-run guided readiness 呈現。
- **Character switching tests**：驗證角色切換後 Companion Stage、Prompt Coach presentation 與 overlay 使用同一 active character。
- **Guided Readiness tests**：驗證 Server、Overlay、Permissions、Codex hooks、Claude Code hooks、AI key optional、Prompt watcher 都有狀態、修復動作或跳過說明。
- **Hook Test Flow tests**：模擬 Codex／Claude Code hook 測試事件，驗證 event server 收到事件後 Dashboard work state 與 overlay reaction 更新。
- **Privacy tests**：驗證 Prompt Coach 不保存 raw prompt 到 event stream，短草稿會被忽略，Vision context 不回寫 image payload。
- **E2E tests**：驗證主要成功流程：完成 readiness、切換角色、輸入 prompt draft、看到角色化 Next Step、發出 hook 測試事件、overlay 反應。桌面與窄版都要檢查沒有文字截斷、重疊，且主要 companion canvas 非空。

**Mock 邊界與契約測試**

純 mock 的 unit test 只能驗證程式碼照預期呼叫，不能證明外部或系統邊界真的符合假設。凡是碰到真實邊界，除了 mock-based unit test 外，必須補契約測試、整合測試或 E2E：

- Codex／Claude Code hook payload：需要用真實或捕捉到的 hook payload 驗證 normalizer 與 hook test flow，而不只靠手寫 mock。
- 本機 HTTP endpoint：需要驗證 event server、settings、session summary、vision context、placement diagnostic 等 endpoint 的 request／response contract。
- Electron overlay 與 macOS Accessibility：需要測試 foreground app、window bounds、permission unavailable、placement fallback、no-fly region fallback 等可觀察行為。
- Prompt watcher：需要涵蓋目標 app 不暴露文字欄位、權限不足、草稿太短、草稿 settled 後才發出建議等邊界。
- AI／Vision provider：mock test 之外，保留可手動或條件式執行的 provider contract test，驗證 structured output、fallback 與 image payload 不被保存。
- 核心 user flow：需要 Playwright E2E 覆蓋 readiness、角色切換、Prompt Coach、hook 測試事件與 overlay 反應。

如果 mock 和真實邊界契約不一致，應修正真實整合或實作邏輯，不可調整 mock 來掩蓋問題。

**UI 設計與開發**

修改 Dashboard、Companion Stage、Characters、Prompt Coach、Readiness、Diagnostics 或 overlay UI 時，計畫與實作必須使用 frontend-design 流程輔助設計開發。完成前需用瀏覽器檢查桌面與窄版 viewport，確認文字沒有截斷、UI 沒有重疊、canvas 非空、角色和診斷資訊不互相遮擋。

完成定義：

1. 本地 quality gate 通過，包含單元測試與瀏覽器層級 E2E。
2. 新使用者不讀 README，也能從 Dashboard 理解下一步。
3. 三角色切換後，視覺與 coaching 語氣都有明顯差異。
4. 沒有 AI key 時，核心 daily flow 仍可完成。
5. hooks 或 permissions 失敗時，有可執行的修復或跳過路徑。

## Out of Scope

- 不做 `.vccpack` 匯入、外部 pack 格式、pack DSL 或 pack validator。
- 不做角色包商店、外部購買流程、license key、本機簽章驗證、帳號、同步或付費。
- 不做 Cursor、Windsurf、VS Code 或其他工具的完整支援。
- 不把 AI key 改成必要條件，也不內建雲端 AI 帳號。
- 不建立每個角色完全獨立的 coaching engine。
- 不讓角色 profile 執行任意程式碼。
- 不重做底層 event model、hook adapter、placement policy 或 AI provider adapter 的核心責任。
- 不把 Dashboard 做成完整 companion room、養成系統、任務遊戲或社群展示平台。
- 不加入聲音、系統通知、長期成就、道具或角色等級。
- 不處理 macOS app signing、notarization、auto-update、安裝器或正式發行包裝。

## Further Notes

後續商業化方向暫時保留，不進入本 PRD 範圍。已討論但延後的方向包括：免費基礎角色加付費三角色套組、外部購買與匯入 `.vccpack`、本機簽章/license 驗證、資料包加白名單 coaching DSL、創作者合作包、內建商店與帳號同步。

本 PRD 的第一優先不是變現機制，而是驗證產品本身是否能成立：一位使用者完成第一次 readiness 後，是否會覺得這是一個有個性、可日用、低干擾且真的連到 coding agent 工作狀態的電子夥伴。
