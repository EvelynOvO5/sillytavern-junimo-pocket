# 0.19.3 · 真正的聊天App全局CSS

聊天App设置里的“气泡与页面 · 全局外观”作用于整个聊天App：列表、会话、设置及从聊天内打开的相关弹窗。单聊和群聊的CSS只作用于对应会话，可覆盖全局样式；恢复独立默认会移除独立CSS，继续使用全局样式。全局样式限定在聊天App与标记为聊天所属的弹窗，不影响手机其他App和酒馆正文。原有预设及已选全局预设保留。

常用选择器：#chatApp、#chatListView、.chat-thread、.chat-thread-name、.chat-bubble、.chat-room-bar、.chat-room-body、.chat-composer、.jp-chat-surface、.jp-review-card、.jp-info-card、.jp-info-row、.jp-sheet-head。全局CSS中的 :root / body 对应整个聊天App与聊天弹窗的根节点，可设置通用颜色和变量。
