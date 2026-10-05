# 0.17.0 更新

- 图鉴内置世界书的29个普通包、6个月亮谷特色包，支持金币献祭、金星需求使用铱星替代、完成奖励与永久开放记忆。提交与奖励属于各聊天存档，刷新不重复发放。
- 图鉴采用内置像素月亮书图标，无需外部图床。
- 后加入插件会按顺序读取旧正文中的状态块，旧楼不额外请求主动聊天。下次继续正文时携带一次历史参考，补全穿着、技能、配方等遗漏信息；已有存档保留。参考最多24000字，长聊天按各楼摘取片段，不能保证恢复正文从未明确写出的数值。
- 制作分工业、食物、家具，只有学习完整图纸才能制作。材料与费用实际扣除，成品入背包。图纸可随正文新增，也可从阅读角色来信学习。
- 农场接收正文推荐的工程，显示材料、费用、工期与效果；开工即时扣除资源，进度和完工由故事推进。
- 各App提供带修改指令的重roll，变量先预览再确认。聊天与邮件保留原有重roll按钮并加入指令输入；总设置可选择校正范围。朋友圈只改角色既有动态/评论，图鉴校正已解锁物品分类，动物校正既有动物年龄、友谊、心情与照料状态；不改写已结算产物与献祭交易。献祭清单仍由其设置管理。
- 背包新增穿着和五项技能面板。等级阈值参照星露谷；各事件经验采用月亮谷简化规则，写入配套世界书。经验由正文输出累计值，重读不自动叠加。

## 验证

117项自动检查通过；独立浏览器测试确认食谱读取、制作扣料、献祭提交、奖励防重复和状态面板。测试不调用用户实际API、不修改真实游戏进度。

## 图标

使用内置imagegen生成；原图保存于 assets/collection-icon.png，显示用图内嵌在界面模块，手动文本发布无需上传PNG。
提示词：Create one transparent-background pixel art inventory collection encyclopedia app icon for a cozy Stardew Valley inspired farming RPG phone interface. A small chunky closed sage-green field guide book with warm cream page edges, golden crescent moon emblem on cover and a tiny pink ribbon bookmark. Strict crisp square pixel clusters, charming 32-bit farm game item sprite, limited muted sage, honey gold, cream, rose and brown palette, dark brown pixel outline, subtle pixel highlights. Single centered isolated object, readable at 52x52 display size, generous transparent margin, no text, no lettering, no surrounding tile or scenery, no gradients, no smooth vector edges. Square canvas.

技能阈值参考：https://stardewvalleywiki.com/Skills
