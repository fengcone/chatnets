# Chatnets Chrome Extension

Chrome 插件，用于采集 DeepSeek 聊天记录并构建个人知识图谱。

## 功能特性

- ✅ 自动监听 DeepSeek 聊天页面
- ✅ 实时采集用户与 AI 的对话内容
- ✅ 本地浏览器存储（支持导出 JSON）
- ✅ 可选同步到本地服务（http://127.0.0.1:8766）
- ✅ 查漏补缺机制（自动去重）

## 安装方法

1. 打开 Chrome 浏览器，进入 `chrome://extensions/`
2. 开启右上角"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `chatnets-extension` 目录
5. 插件安装完成！

## 使用方法

1. 访问 https://chat.deepseek.com/ 并开始对话
2. 插件会自动采集对话记录
3. 点击插件图标查看统计信息
4. 点击"导出全部记录"按钮可导出 JSON 文件

## 数据存储

- **本地存储**：所有数据存储在浏览器的 `chrome.storage.local` 中
- **导出格式**：JSON 文件，包含 sessions 和 messages 两部分
- **本地服务**：如果启动了本地服务（端口 8766），会自动同步

## 文件说明

- `manifest.json` - 插件配置文件
- `background.js` - 后台服务脚本（消息处理、存储、导出）
- `content-script.js` - 内容脚本（DOM 监听、消息提取）
- `popup.html/js` - 弹窗界面（统计与导出）
- `icon.png` - 插件图标

## 开发调试

1. 修改代码后，在 `chrome://extensions/` 点击"重新加载"
2. 查看 background 日志：点击"service worker"链接
3. 查看 content script 日志：在 DeepSeek 页面打开开发者工具（F12）
4. 查看存储数据：Chrome DevTools → Application → Storage → Local Storage

## 下一步计划

- [ ] 优化 DOM 选择器（适配更多页面结构）
- [ ] 支持更多 AI 聊天平台（ChatGPT、Claude 等）
- [ ] 改进消息角色检测算法
- [ ] 增加配置页面（本地服务地址、采集规则等）

## 注意事项

- 所有数据仅存储在本地，不会上传到任何服务器
- 如需跨设备同步，请使用导出/导入功能
- 建议定期导出备份数据
