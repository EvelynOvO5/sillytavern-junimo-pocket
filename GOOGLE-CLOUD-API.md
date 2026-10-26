# Google Cloud / Agent Platform API Key

在手机设置的“01 · API 连接”选择“Google Cloud API Key（Gemini 原生）”。Key 填到原来的密码框，模型手动填写实际可用的 Gemini ID，例如 gemini-2.5-flash（也接受 google/ 前缀）。保存后点击“测试连接”。

- Express Key：地址填 https://aiplatform.googleapis.com/v1。Express 不使用项目和地区路径。
- 带项目身份的 Key：保留 https://aiplatform.googleapis.com/v1/projects/项目ID/locations/global/endpoints/openapi，插件转换到相同项目的原生 generateContent 路径；地区接口需让域名与 locations 一致。不要将项目 Key 与 Express 地址混用。
- OAuth 访问令牌或第三方中转：继续选“OpenAI 兼容”，地址及模型按提供方要求填写。当前未实现服务账号 JSON 登录和自动刷新 OAuth 令牌。

新模式使用 x-goog-api-key，不发送 Authorization，不将 Key 放入网址，不尝试另一个域名或项目重试。支持文字规则、多轮历史及本地图片的 inlineData；图床图片需先转为本地上传。当前使用非流式 generateContent，原有流式选项会暂时禁用。新模式不访问 OpenAI 的 /models；应手动填写模型。旧预设没有接入方式时按原来的 OpenAI 模式恢复。

仅接收第一个候选的最终文字，不将 thought 思考文字作为回复；输出达到上限、拒绝生成、缺少完成标记或空正文均报错，不应用残缺内容。Google 返回的权限、API 开通、额度、Key 限制及浏览器跨域问题仍需按具体报错处理。

验证使用模拟服务响应，未使用真实 Key 或付费调用。不能据此保证任意 Google Cloud Key 均具备所需权限。

官方资料：
- https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/express-mode/api-reference
- https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/start
- https://ai.google.dev/api/generate-content
