# Ries Glossary Translator 浏览器扩展

该扩展基于 [Ries Learn English](https://ries.ai/zh/learn-english) 的学习方法，实现了一套与大模型接口协作的术语敏感翻译体验：在翻译中文文本时，预设的重点术语会被替换为 `English(中文)` 的格式，并通过下划线进行标注，便于记忆和复习。

## 功能概览

- 🔄 **右键一键翻译**：选中文本后选择 “Ries Glossary 翻译选中内容”，在当前页面右上角浮窗中即可查看结果。
- 💡 **术语自动替换**：对术语表中的中文词汇强制使用指定英文翻译，并保留原文括注，输出格式 `artificial intelligence(人工智能)` 并加下划线。
- 🧠 **大模型驱动**：支持任意兼容 OpenAI Chat Completions 协议的接口（可自定义 Base URL、模型名、Temperature）。
- 🛠️ **可视化管理术语表**：通过设置页新增、删除或调整术语条目，所有配置存储在浏览器同步存储中。
- 📝 **弹窗快速翻译**：在扩展弹窗中手动输入中文段落，随时获取带术语标记的翻译。

## 目录结构

```
extension/
├── background.js        # Service Worker，负责上下文菜单与翻译请求
├── content-script.js    # 页面浮窗与翻译结果展示
├── manifest.json        # Chrome 扩展清单 (Manifest V3)
├── options.css          # 设置页样式
├── options.html         # 设置页结构
├── options.js           # 设置页逻辑（API/术语配置）
├── popup.css            # 弹窗样式
├── popup.html           # 弹窗结构
└── popup.js             # 弹窗逻辑（手动翻译、术语预览）
```

## 安装与调试

1. 在本地运行 `pnpm install`、`npm install` 等步骤并非必需，只需获取本仓库源码即可。
2. 打开 Chrome/Edge，访问 `chrome://extensions/`（或 `edge://extensions/`），打开右上角 **开发者模式**。
3. 点击 **加载已解压的扩展程序**，选择仓库中的 `extension` 目录。
4. 在扩展的 “详情” 页中点击 “扩展选项”，填写：
   - API Base URL（默认 `https://api.openai.com/v1`）
   - API Key（OpenAI 或兼容服务的 Key）
   - 模型名称（默认 `gpt-4o-mini`）
   - Temperature（默认 `0.2`）
   - 术语表（支持多个中英条目）
5. 保存后即可使用：
   - 在任意页面选中文本 → 右键菜单选择 “Ries Glossary 翻译选中内容”
   - 或点击扩展图标，使用弹窗直接输入文本翻译

> ⚠️ **隐私说明**：API Key 仅保存在浏览器的同步存储中，扩展不会将其上传到其它服务器。请根据自身安全策略评估使用。

## 工作流程说明

1. **翻译请求**：内容脚本或弹窗向 Service Worker 发送消息，后者读取存储的配置并向大模型接口发起 Chat Completions 请求。
2. **提示构造**：背景脚本会自动生成提示，告知模型需严格按照术语表输出，且使用 `_English(中文)_` 的格式，保证后续渲染可加下划线。
3. **结果处理**：拿到模型返回后，背景脚本会将命中的术语替换成 `<span class="ries-glossary-term">English(中文)</span>`，同时保留原始文本用于复制。
4. **结果展示**：
   - 内容脚本以右上角浮窗形式显示原文与译文，并支持一键复制。
   - 弹窗界面同步显示译文，并提供术语表预览。

## 自定义与扩展

- 如需适配不同大模型厂商，只要其接口兼容 OpenAI Chat Completions（或支持兼容的代理），即可直接通过设置页更改 Base URL 与模型名。
- 术语表支持任意数量条目，插件会自动忽略未填写完整的项。
- 若希望将译文嵌入页面其它区域，可在 `content-script.js` 中自定义浮窗渲染逻辑。

## 许可协议

本项目采用 MIT License 发布，欢迎在学习与项目中使用或定制。
