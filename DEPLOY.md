# Telegram Bot Vercel 部署指南

## 前置要求

1. **Node.js 18+** - https://nodejs.org （下载 LTS 版本）
2. **Vercel 账号** - https://vercel.com （可用 GitHub 账号登录）
3. **Telegram Bot Token** - 从 @BotFather 获取

---

## 部署步骤

### 1. 安装 Node.js

访问 https://nodejs.org 下载并安装 LTS 版本

安装后验证：
```bash
node -v
npm -v
```

### 2. 安装 Vercel CLI

```bash
npm install -g vercel
```

### 3. 登录 Vercel

```bash
vercel login
```

会打开浏览器让你授权登录

### 4. 部署项目

```bash
# 进入项目目录
cd telegram-bot

# 安装依赖
npm install

# 部署到 Vercel
vercel --prod
```

### 5. 配置环境变量

部署完成后：

1. 访问 https://vercel.com/dashboard
2. 找到你的项目，点击进入
3. 点击 **Settings** → **Environment Variables**
4. 添加变量：
   - **Name**: `TELEGRAM_BOT_TOKEN`
   - **Value**: 你的 Bot Token（从 @BotFather 获取）
5. 点击 **Save**
6. 重新部署：`vercel --prod`

### 6. 设置 Webhook

部署完成后，访问：

```
https://你的域名/api/set-webhook?action=set
```

例如：
```
https://telegram-bot-xxx.vercel.app/api/set-webhook?action=set
```

看到 `{"status": "success"}` 就成功了！

---

## 获取 Bot Token

1. 在 Telegram 搜索 `@BotFather`
2. 发送 `/newbot`
3. 按提示设置：
   - 机器人名称（显示名称）
   - 机器人用户名（必须以 bot 结尾，如：my_ai_bot）
4. 保存 Token（格式：`123456789:ABCdefGHIjklMNOpqrsTUVwxyz`）

---

## 测试机器人

在 Telegram 中：
1. 搜索你的机器人用户名
2. 点击 **Start**
3. 发送 `/status`
4. 应该收到状态回复

---

## 常用命令

```bash
# 查看部署状态
vercel

# 查看日志
vercel logs

# 重新部署
vercel --prod

# 打开项目页面
vercel open
```

---

## 故障排除

### 问题：部署失败

**解决：**
```bash
# 清除缓存重新部署
vercel --force
```

### 问题：机器人不回复

**检查：**
1. Token 是否正确设置
2. Webhook 是否设置成功
3. 查看 Vercel 日志：`vercel logs`

### 问题：Webhook 设置失败

**手动设置：**
```bash
# 获取你的 Vercel 域名
curl https://api.telegram.org/bot<你的Token>/setWebhook?url=https://你的域名/api/webhook
```

---

## 升级：接入 OpenAI

如果想让机器人用 GPT 回复：

1. 获取 OpenAI API Key：https://platform.openai.com
2. 在 Vercel 添加环境变量：`OPENAI_API_KEY`
3. 修改 `api/webhook.js` 中的 `handleAIResponse` 函数
4. 重新部署

---

## 需要帮助？

在 Telegram 中向 @BotFather 发送 `/help` 查看 Bot API 文档
