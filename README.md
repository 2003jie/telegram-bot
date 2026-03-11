# TG网盘机器人 v3.0 📁

利用 Telegram 私有群组作为无限网盘，支持分类管理、永久存储！

## ✨ 核心功能

- 📤 **文件上传** - 支持视频、图片、文档、音频、语音
- 📁 **分类管理** - 自动分类到视频/图片/文档/音频/语音文件夹
- 🆔 **分享ID** - 6位短ID，方便分享给他人
- 📥 **ID取回** - 发送ID即可获取文件
- 🔒 **隐私安全** - 文件存储在你的私有群组，Telegram官方加密
- ♾️ **永久保存** - 文件不过期，随时可取

## 🚀 快速部署

### 1. 创建 Telegram 机器人

1. 在 Telegram 搜索 `@BotFather`
2. 发送 `/newbot` 创建机器人
3. **保存好 Token**（格式：`123456789:ABCdefGHIjklMNOpqrsTUVwxyz`）

### 2. 创建私有存储群组

1. 在 Telegram 新建一个群组（只拉你自己和机器人）
2. 给机器人 **管理员权限**（必须能发送消息）
3. **获取群组ID**：
   - 临时方案：在群组发消息，然后访问 `https://api.telegram.org/bot<你的Token>/getUpdates`
   - 找到 `"chat":{"id":-100xxxxxxxxx` 这个ID就是群组ID

### 3. 部署到 Vercel

#### 方式 A：命令行部署

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel --prod
```

#### 方式 B：GitHub + Vercel 自动部署

1. Fork 这个仓库到 GitHub
2. 在 Vercel 导入项目
3. 配置环境变量（见步骤4）
4. 自动部署

### 4. 配置环境变量

在 Vercel 控制台 → Settings → Environment Variables 添加：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `TELEGRAM_BOT_TOKEN` | BotFather 给的 Token | `123456:ABCdef...` |
| `TELEGRAM_GROUP_ID` | 私有群组ID | `-1001234567890` |

### 5. 设置 Webhook

部署完成后，浏览器访问：
```
https://你的域名/api/set-webhook?action=set
```

看到 `{"status": "success"}` 就成功了！

## 📖 使用方法

### 上传文件
1. 发送任何文件给机器人
2. 点击选择分类（视频/图片/文档/音频/语音）
3. 获得分享ID

### 下载文件
- 直接发送 **6位分享ID**（如：`Ab3x9K`）
- 机器人会发送文件给你

### 浏览网盘
- 发送 `/folder` 或点击「📂 打开网盘」
- 查看各分类文件夹的文件列表

### 常用命令

| 命令 | 功能 |
|------|------|
| `/start` | 开始使用，显示主菜单 |
| `/help` | 查看使用帮助 |
| `/folder` | 打开网盘文件夹 |
| `/stats` | 查看存储统计 |

## 📁 文件分类

| 分类 | 图标 | 说明 |
|------|------|------|
| 视频 | 🎬 | MP4, AVI, MKV 等 |
| 图片 | 🖼 | JPG, PNG, GIF 等 |
| 文档 | 📄 | PDF, DOC, TXT 等 |
| 音频 | 🎵 | MP3, WAV, FLAC 等 |
| 语音 | 🎤 | Telegram 语音消息 |

## 🔐 隐私说明

- ✅ 文件存储在你的**私有群组**，只有你可见
- ✅ Telegram 官方端到端加密
- ✅ 不需要第三方数据库
- ✅ 机器人重启后文件不丢失（在群组里永久保存）
- ⚠️ 注意：分享ID给别人后，对方也能下载该文件

## 🛠 技术架构

```
用户 → 发送文件 → 机器人
                ↓
           选择分类
                ↓
         转发到私有群组
                ↓
         生成分享ID → 返回给用户
```

## 📝 文件结构

```
telegram-bot/
├── api/
│   ├── webhook.js      # 主 webhook 处理
│   └── set-webhook.js  # 设置 webhook 工具
├── package.json        # 依赖配置
├── vercel.json         # Vercel 配置
└── README.md           # 本文件
```

## ⚠️ 已知限制

1. **缓存丢失**：机器人重启后，通过ID查找文件会失效（但文件仍在群组中）
   - 解决方案：可从群组转发文件给机器人
   - 进阶方案：接入 Vercel KV 等数据库持久化缓存

2. **文件搜索**：目前不支持关键词搜索文件名
   - 可通过分类文件夹浏览

3. **群组必须**：需要一个私有群组作为存储

## 🔧 进阶配置

### 接入 Vercel KV（推荐）

如果你想让ID永久有效（即使机器人重启）：

1. 在 Vercel 控制台添加 Vercel KV 集成
2. 安装依赖：`npm install @vercel/kv`
3. 修改代码，用 `kv.set()` 和 `kv.get()` 替换 `fileCache`

### 添加自定义分类

在 `webhook.js` 中修改 `FILE_CATEGORIES`：

```javascript
const FILE_CATEGORIES = {
  video: { name: '🎬 视频', emoji: '🎬' },
  photo: { name: '🖼 图片', emoji: '🖼' },
  // 添加你自己的分类...
  mycategory: { name: '📦 我的分类', emoji: '📦' }
};
```

## 💰 免费额度

| 服务 | 免费额度 |
|------|----------|
| Vercel Hobby | 100GB/月 带宽 |
| Telegram | 无限存储（单文件最大2GB） |

## 🐛 常见问题

**Q: 机器人不回复？**
- 检查 Token 是否正确
- 确认 webhook 已设置
- 查看 Vercel Functions 日志

**Q: 文件保存失败？**
- 确认机器人是群组管理员
- 检查群组ID是否正确（以 -100 开头）

**Q: 通过ID找不到文件？**
- 机器人重启后缓存丢失是正常的
- 可从群组手动转发文件给机器人
- 或接入 Vercel KV 数据库

**Q: 可以限制谁使用吗？**
- 可以修改代码，添加用户白名单
- 或设置群组为私有，只允许特定用户

## 📚 参考

- [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api)
- [Vercel Functions](https://vercel.com/docs/functions)
- [Telegram Bot API](https://core.telegram.org/bots/api)

---

有问题？在 Telegram 中向你的机器人发送反馈！
