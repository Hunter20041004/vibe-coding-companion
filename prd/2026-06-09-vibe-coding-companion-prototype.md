---
status: draft
created: 2026-06-09
---

# PRD: Vibe Coding Companion Prototype

## Why / Background

Vibe coding 工具正在從「聊天式助理」走向「可執行工作的 coding agent」。現有產品多半用 log、diff、進度文字、任務側欄來呈現 agent 正在做什麼；這些介面可靠，但等待 agent 思考、改 code、跑測試時仍偏工具感，缺少陪伴感與趣味。

本專案要先驗證一個產品假設：如果 coding agent 工作時，有一個原創像素角色根據狀態自動反應，使用者是否會覺得等待過程更有趣、更容易理解 agent 目前在做什麼，而且不會干擾 coding。

決策者視角：第一版不直接整合 Codex 或 Claude，也不做完整自家 agent UI。先做 Web app prototype，降低平台限制與工程成本，快速驗證角色狀態模型、動畫節奏、模式切換與小浮窗體驗。若體驗成立，下一步優先評估 Codex pet／overlay 整合，再評估 Claude hooks 或自家 agent UI。

使用者視角：使用者在 vibe coding 時常會遇到 agent 正在工作但畫面等待感很重，不知道現在是思考、讀檔、改 code、跑測試還是卡住。這個 companion 要讓使用者一眼知道狀態，同時透過慌張又調皮的像素 blob 角色，讓等待過程更有戲但不造成焦慮。

## Solution

第一版是一個 Web app prototype，視覺上像浮在 coding agent 畫面上的半透明 companion overlay。背景使用淡化的 fake coding agent 介面，只用來暗示使用場景，不複製任何特定產品 UI。

前景是一個可拖曳、可調整大小的 Canvas pixel blob 角色。角色個性是「慌張型＋調皮型」：遇到 test fail 會冒汗、debug 時手忙腳亂，成功時得意跳舞。角色不使用任何既有 IP，不仿作 Hello Kitty 或 Sanrio 角色，只採用原創抽象 blob 與 pixel art 語言。

工具開啟後，角色會進入 idle。使用者按下開始後，系統自動模擬一段 bug-fix coding session。角色根據 agent state 自動做動作，包含 thinking、reading、coding、testing、error、debugging、success、waiting。流程跑完後會停在 success，短暫停留後進入 waiting，不自動循環，但可 replay。

畫面一次只顯示一行英文狀態文字，不顯示完整 log，也不顯示隱藏思考內容。UI 控制項使用中文，狀態文字保留英文 coding 語境。

第一版提供 3 種模式：

- Calm：完整狀態反應，但動畫幅度降低，文字清楚，粒子減少。
- Snark：中等吐槽感，只吐槽 bug、test 或狀態，不罵使用者、不羞辱程式碼作者。
- Showcase：動畫更大、縮放更明顯，成功時有少量粒子，error 時有小驚嘆號或火花；不做螢幕震動、不做強閃光。

畫面包含 Vibe Meter 與小狀態燈。Vibe Meter 不只是展示，會輕量影響動畫：低 vibe 時角色更慌張、縮小、抖動或冒汗；高 vibe 時角色更調皮、動作更大、成功時更得意。

角色位置、角色大小與模式會用瀏覽器本機設定記住。第一版不做自訂浮窗拖曳或浮窗縮放，直接使用瀏覽器視窗本身處理。

## User Stories & Scenarios

**Scenario 1：第一次打開 prototype**

- Given 一位「vibe coding 使用者」第一次打開 prototype
- When 頁面載入完成
- Then 使用者會看到淡化的 coding agent 背景、半透明 companion overlay、像素 blob 角色、一行 idle 狀態、Vibe Meter、小狀態燈與中文控制項
- So that 使用者能在 10 秒內理解這是一個浮在 coding agent 上的 companion

**Scenario 2：自動跑 bug-fix session**

- Given 一位「vibe coding 使用者」已打開 companion
- When 點擊開始 session
- Then 系統會自動跑一段 bug-fix 小劇場，角色依序對 thinking、reading、coding、testing、error、debugging、success、waiting 做出不同動畫反應
- So that 使用者可以感受到「agent 正在工作」而不是只看到靜態等待畫面

**Scenario 3：流程完成後等待下一步**

- Given 一位「vibe coding 使用者」已跑完 bug-fix session
- When session 到達 success
- Then 角色短暫做成功反應後進入 waiting，畫面提供 replay，但不自動循環
- So that 工具行為更像真實 agent 完成工作後等待使用者檢查，而不是純展示動畫

**Scenario 4：切換 Calm mode**

- Given 一位「vibe coding 使用者」覺得動畫太搶眼
- When 切換到 Calm mode
- Then 角色仍保留完整狀態反應，但移動、縮放與粒子幅度降低，狀態文字更直接
- So that 使用者可以在長時間 coding 時保留陪伴感但降低干擾

**Scenario 5：切換 Snark mode**

- Given 一位「vibe coding 使用者」想要比較有趣的搭檔感
- When 切換到 Snark mode 並跑到 error 或 debugging
- Then 狀態文字會用中等吐槽語氣描述 bug 或 test 狀態，但不攻擊使用者或程式碼作者
- So that 角色有個性，但不變成 toxic reviewer

**Scenario 6：切換 Showcase mode**

- Given 一位「demo 觀看者」正在看 prototype 展示
- When 切換到 Showcase mode 並跑完整 session
- Then 角色動畫幅度更大，成功時有少量粒子，error 時有小驚嘆號或火花，但沒有螢幕震動或強閃光
- So that demo 更有記憶點，同時維持可用性與可讀性

**Scenario 7：調整角色大小**

- Given 一位「vibe coding 使用者」覺得角色太大或太小
- When 使用角色大小控制項調整比例
- Then 角色以新的基準比例顯示，後續狀態動畫只在此比例上做相對縮放
- So that 使用者可以依照自己的螢幕與干擾容忍度調整 companion

**Scenario 8：拖曳角色位置**

- Given 一位「vibe coding 使用者」想讓角色避開重要內容
- When 拖曳角色到 overlay 內的新位置
- Then 角色的新位置會成為 anchor，狀態動畫只在 anchor 附近表演，不會突然跳到遠處
- So that 角色可被個人化放置，同時保留自動反應

**Scenario 9：重新整理後保留設定**

- Given 一位「vibe coding 使用者」已調整角色位置、角色大小與模式
- When 重新整理頁面
- Then 系統會還原上次的角色位置、角色大小與模式
- So that 使用者不需要每次重新設定 companion

**Scenario 10：開發控制面板測試狀態**

- Given 一位「開發者」正在調整動畫或狀態文字
- When 使用預設展開的 debug panel 手動切換 agent state、Vibe Meter 或角色設定
- Then 畫面會立即反映對應狀態，且不需要跑完整 demo flow
- So that 開發者可以快速驗證單一狀態與邊界情境

**Scenario 11：低 vibe 影響動畫**

- Given 一位「開發者」將 Vibe Meter 調低
- When 觸發 testing 或 error state
- Then 角色會出現更慌張的動畫，例如縮小、抖動、冒汗或小驚嘆號
- So that Vibe Meter 不是靜態裝飾，而會影響角色表現

**Scenario 12：高 vibe 影響動畫**

- Given 一位「開發者」將 Vibe Meter 調高
- When 觸發 success 或 coding state
- Then 角色會出現更調皮或自信的動畫，例如放大、跳得更高或得意動作
- So that 使用者能感受到 mood 與 state 的組合效果

**Scenario 13：不顯示完整 log 或隱藏思考**

- Given 一位「vibe coding 使用者」正在觀看 companion
- When agent state 改變
- Then 畫面只顯示一行可觀測狀態文字，不顯示完整 log，也不呈現模型隱藏思考
- So that 工具既保有清楚狀態，也不誤導使用者以為看到了模型內部思考

## Implementation Decisions

- Prototype shell：負責組合淡化 fake coding agent 背景、半透明 companion overlay、HUD 與 debug panel。第一版是 Web prototype，不引入完整應用框架，優先降低啟動成本。
- Agent event model：定義 9 個 agent states：idle、thinking、reading、coding、testing、error、debugging、success、waiting。狀態模型要能被 demo flow、debug panel 與未來真實事件來源共用。
- Demo flow runner：負責模擬 bug-fix session。它只處理事件順序、時間節奏、Vibe Meter 變化與 completion 行為，不直接處理 Canvas 繪圖。
- Pixel blob renderer：使用 Canvas pixel sprite 產生角色。輸入包含 agent state、mode、vibe level、user anchor、base scale 與時間。輸出是每一幀的角色姿態、像素形狀、粒子與狀態動畫。
- HUD controller：負責一行英文狀態文字、小狀態燈、Vibe Meter、模式切換、開始／重播，以及 debug panel 控制項。
- Preference store：用瀏覽器本機設定記住角色位置、角色大小與 mode。儲存失敗時不得影響主要體驗，最多回到預設值。
- Copy system：依照 state 與 mode 提供狀態文字。Calm 文案清楚直接；Snark 文案中等吐槽但不攻擊人；Showcase 文案較戲劇化但不過度。
- Interaction model：角色拖曳後的位置是 anchor；角色大小是 base scale；狀態動畫只能在 anchor 與 base scale 上做 offset 與 multiplier，不覆蓋使用者設定。
- Accessibility guardrails：第一版不做聲音、不做通知、不做螢幕震動、不做強閃光。動畫需避免干擾閱讀，尤其 Calm mode 必須可長時間觀看。
- Future integration seam：第一版不接 Codex 或 Claude，但事件模型要能映射到未來 Codex pet／overlay、Claude hooks 或 app-server streamed events。

## Testing Decisions

本專案採用 TDD 作為最高開發原則。任何功能、修正或 UI 行為都必須遵守 Red → Green → Refactor。計畫與實作都不得採用水平切片；每次只允許寫一個失敗測試，讓它變綠後才能進入下一個切片。

測試只驗證外部可觀察行為，不測試 Canvas 內部繪圖實作細節。對角色動畫的測試應以「state、mode、vibe、anchor、scale 產生的可觀測輸出」為主，例如角色姿態分類、粒子數量範圍、anchor 附近移動限制、HUD 狀態文字與儲存行為。

需要測試的模組：

- Agent event model：驗證有效狀態、狀態轉換、狀態資料契約與 invalid state 處理。
- Demo flow runner：驗證 bug-fix session 的事件順序、完成後 success 到 waiting、不自動循環、可 replay。
- Vibe Meter：驗證不同事件對 vibe 的影響，以及 vibe level 如何改變動畫強度分類。
- Pixel blob renderer：驗證 renderer 接收相同輸入時輸出穩定的姿態資料，且 user anchor 與 base scale 不被狀態動畫覆蓋。
- HUD controller：驗證一行狀態文字、小狀態燈、模式切換、開始／重播與 debug panel 的外部行為。
- Preference store：驗證角色位置、角色大小與 mode 會保存與還原；儲存資料失效時回到預設值。
- 使用者流程：用瀏覽器層級測試驗證第一次打開、開始 session、切換模式、拖曳角色、調整大小、重新整理保留設定。

TDD delivery plan 採垂直切片：

1. Shell 可啟動
   - Red：寫一個測試描述第一次載入時應看到 companion overlay、idle 狀態、Vibe Meter 與 debug panel。
   - Green：實作最小 shell 與靜態 HUD，讓測試通過。
   - Refactor：整理命名與 DOM 結構，確認測試仍全綠。

2. Agent state model
   - Red：寫一個測試描述 idle 是初始狀態，且 9 個 states 都能被查詢或設定。
   - Green：實作最小狀態模型。
   - Refactor：整理狀態命名與契約，確認測試仍全綠。

3. 狀態文字與狀態燈
   - Red：寫一個測試描述切換到 testing 時，HUD 只顯示一行英文狀態文字，狀態燈反映 running 類型。
   - Green：實作最小 HUD 更新。
   - Refactor：把 state 到 copy、state 到燈號的對應整理成穩定介面，確認測試仍全綠。

4. Demo flow runner
   - Red：寫一個測試描述開始 session 後會依序進入 bug-fix flow，且完成後從 success 轉到 waiting。
   - Green：實作最小 flow runner。
   - Refactor：拆清楚 flow timing 與 state dispatch，確認測試仍全綠。

5. Replay 行為
   - Red：寫一個測試描述 session 完成後不自動循環，但可以 replay。
   - Green：實作 replay。
   - Refactor：整理 session lifecycle，確認測試仍全綠。

6. Mode copy
   - Red：寫一個測試描述同一個 error state 在 Calm、Snark、Showcase 會顯示不同語氣，但 Snark 不攻擊使用者或作者。
   - Green：實作文案系統。
   - Refactor：整理文案資料結構，確認測試仍全綠。

7. Vibe Meter 對動畫強度的影響
   - Red：寫一個測試描述低 vibe 會產生 panic 強度，高 vibe 會產生 playful 強度。
   - Green：實作 vibe 到 animation intensity 的映射。
   - Refactor：整理強度區間與命名，確認測試仍全綠。

8. Canvas pixel blob renderer
   - Red：寫一個測試描述 renderer 在 testing＋低 vibe 時輸出慌張姿態，在 success＋高 vibe 時輸出得意姿態。
   - Green：實作最小 Canvas renderer 與姿態輸出。
   - Refactor：整理 renderer 輸入輸出，確認測試仍全綠。

9. 角色大小控制
   - Red：寫一個測試描述使用者調整 base scale 後，renderer 以該比例為基準，狀態動畫只做相對縮放。
   - Green：實作大小控制。
   - Refactor：整理 scale 計算，確認測試仍全綠。

10. 角色拖曳位置
   - Red：寫一個測試描述拖曳角色後，anchor 更新，後續狀態動畫不會離開 anchor 附近的允許範圍。
   - Green：實作拖曳與 anchor 約束。
   - Refactor：整理指標事件與邊界處理，確認測試仍全綠。

11. Preference store
   - Red：寫一個測試描述重新整理後會還原角色位置、角色大小與 mode。
   - Green：實作本機設定儲存與載入。
   - Refactor：整理儲存 schema 與 fallback，確認測試仍全綠。

12. Browser user flow
   - Red：寫一個瀏覽器層級測試描述使用者能開始 session、切換 mode、調整角色，且畫面沒有明顯重疊或文字截斷。
   - Green：修正 UI 與互動直到流程通過。
   - Refactor：整理樣式與互動細節，確認所有測試仍全綠。

未來若接入 Codex、Claude 或任何外部 agent event source，不能只用純 mock unit test。必須補真實邊界測試或契約測試，驗證外部事件格式、生命週期事件、失敗情境與權限限制真的符合實作假設。若 mock 與真實邊界不一致，應修正真實整合或實作邏輯，不可調整 mock 來掩蓋問題。

修改網站 UI 時，開發流程必須搭配 frontend-design skill，確保視覺設計符合透明 overlay＋迷你遊戲 HUD 的方向，並實際用瀏覽器檢查桌面與窄視窗沒有重疊、截斷或干擾閱讀。

## Out of Scope

- 不直接整合 Codex、Claude、Cursor、VS Code 或任何 IDE。
- 不製作完整自家 agent UI，不處理真實聊天、approval、terminal、diff 或檔案修改。
- 不使用或仿作 Hello Kitty、Sanrio 或任何既有 IP。
- 不做聲音、桌面通知、瀏覽器通知或完成提醒。
- 不做完整桌面 overlay、點擊穿透、視窗永遠置頂或系統層級權限。
- 不做自訂浮窗拖曳或浮窗縮放。
- 不做完整養成系統、等級、徽章、道具或長期成就。
- 不顯示完整 log，不顯示模型隱藏思考。
- 不導入 Rive、Lottie、Live2D 或外部動畫素材流程。
- 不建立後端、資料庫或第三方 API 整合。

## Further Notes

第一版成功標準：

1. 使用者打開 10 秒內看得懂這是浮在 coding agent 上的 companion。
2. 跑一次 bug-fix demo 後，角色狀態變化有趣且不干擾閱讀。
3. 拖曳位置、調整大小、切換模式後，體驗穩定，重新整理會記住設定。

下一階段若 prototype 驗證成功，優先評估 Codex pet／overlay 路線，因為它最接近「直接顯示在 Codex 畫面上」的產品方向。Claude hooks 與自家 agent UI 保留為後續整合選項。
