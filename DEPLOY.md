# TG网盘机器人部署指南

## 📋 部署前准备

### 1. 创建 Telegram 机器人
1. 在 Telegram 搜索 `@BotFather`
2. 发送 `/newbot` 创建机器人
3. 设置名称和用户名
4. **复制保存 Token**（格式：`123456789:ABCdef...`）

### 2. 创建私有存储群组
1. 在 Telegram 新建群组
2. 拉机器人进群
3. 设置机器人为**管理员**（必须）
4. **获取群组ID**：
   - 群组发条消息
   - 浏览器访问：`https://api.telegram.org/bot<你的Token>/getUpdates`
   - 找到 `"chat":{"id":-100xxxxxxxxx`，这就是群组ID

---

## 🚀 部署到 Vercel

### 方式一：命令行部署（推荐）

```bash
# 1. 安装 Vercel CLI
npm i -g vercel

# 2. 登录
vercel login

# 3. 进入项目目录
cd telegram-bot

# 4. 部署
vercel --prod
```

### 方式二：GitHub + Vercel 自动部署

1. 把代码推送到 GitHub
2. 登录 [Vercel](https://vercel.com)
3. 点击 "Add New Project"
4. 导入 GitHub 仓库
5. 配置环境变量（见下文）
6. 点击 Deploy

---

## ⚙️ 配置环境变量

在 Vercel 控制台设置：

| 变量名 | 值 |
|--------|-----|
| `TELEGRAM_BOT_TOKEN` | 从 BotFather 获取的 Token |
| `TELEGRAM_GROUP_ID` | 私有群组ID（如：-1001234567890）|

### 设置步骤：
1. Vercel 控制台 → 你的项目 → Settings
2. 点击 "Environment Variables"
3. 添加上面两个变量
4. 点击 Save
5. **重新部署**（重要！）

---

## 🔗 设置 Webhook

部署完成后，浏览器访问：

```
https://你的域名/api/set-webhook?action=set
```

成功会显示：
```json
{
  "status": "success",
  "message": "Webhook 设置成功"
}
```

---

## ✅ 验证部署

1. 在 Telegram 给你的机器人发送 `/start`
2. 应该收到欢迎消息
3. 发送一个文件，测试上传功能

---

## 🐛 常见问题

### 机器人不回复
- 检查 Token 是否正确
- 确认 webhook 已设置
- 查看 Vercel Functions 日志

### 文件保存失败
- 确认机器人是群组管理员
- 检查群组ID是否正确（必须以 -100 开头）
- 确认群组存在且机器人已在群内

### ID找不到文件
- 机器人重启后缓存丢失是正常的
- 可从群组手动转发文件给机器人
- 或接入 Vercel KV 数据库持久化

---

## 📁 项目文件说明

```
telegram-bot/
├── api/
│   ├── webhook.js      # 主程序（文件上传/下载/分类）
│   └── set-webhook.js  # Webhook 设置工具
├── package.json        # 项目依赖
├── vercel.json         # Vercel 配置
├── .env.example        # 环境变量模板
├── README.md           # 项目说明
└── DEPLOY.md           # 部署指南（本文件）
```

---

## 🔧 进阶配置

### 接入 Vercel KV（让ID永久有效）

如果想让分享ID永久有效（即使机器人重启）：

1. Vercel 控制台 → Storage → Create Database → KV
2. 连接到你的项目
3. 安装依赖：`npm install @vercel/kv`
4. 修改代码，用 `kv.set()` 和 `kv.get()` 替换 `fileCache`

---

## 💡 使用提示

- 单文件最大支持 2GB（Telegram限制）
- 文件永久保存在群组中
- 分享ID给别人后，对方也能下载
- 可以创建多个群组分类存储

---

有问题？在 Telegram 中向你的机器人发送反馈！
