# Telegram Bot on Vercel 🤖

免费部署 Telegram 机器人到 Vercel，无需服务器！

## 快速开始

### 1. 创建 Telegram 机器人

1. 在 Telegram 搜索 `@BotFather`
2. 发送 `/newbot`
3. 按提示设置机器人名称和用户名
4. **保存好 Token**（格式：`123456789:ABCdefGHIjklMNOpqrsTUVwxyz`）

### 2. 部署到 Vercel

#### 方式 A：一键部署（推荐）
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

#### 方式 B：命令行部署

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel --prod
```

### 3. 配置环境变量

在 Vercel 控制台设置环境变量：

| 变量名 | 值 |
|--------|-----|
| `TELEGRAM_BOT_TOKEN` | 你的 Bot Token |

### 4. 设置 Webhook

部署完成后，访问：
```
https://你的域名/api/set-webhook?action=set
```

看到 `{"status": "success"}` 就成功了！

## 使用方法

在 Telegram 中对你的机器人发送：

- `/start` - 开始使用
- `/help` - 查看帮助
- `/ai 你的问题` - 问 AI 问题
- `/status` - 查看状态
- 直接发送消息 - AI 智能回复

## 自定义功能

### 接入 OpenAI GPT

1. 获取 OpenAI API Key
2. 在 Vercel 添加环境变量 `OPENAI_API_KEY`
3. 修改 `api/webhook.js` 中的 `handleAIResponse` 函数：

```javascript
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function handleAIResponse(bot, chatId, text, msg) {
  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: text }]
  });
  
  await bot.sendMessage(chatId, completion.choices[0].message.content);
}
```

### 添加新命令

在 `handleCommand` 函数中添加：

```javascript
case '/mycmd':
  await bot.sendMessage(chatId, '我的自定义命令');
  break;
```

### 添加数据库

可以使用 Vercel KV、Upstash Redis 等免费数据库：

```javascript
// 使用 Vercel KV
import { kv } from '@vercel/kv';

// 保存数据
await kv.set('key', 'value');

// 读取数据
const value = await kv.get('key');
```

## 文件结构

```
telegram-bot/
├── api/
│   ├── webhook.js      # 主 webhook 处理
│   └── set-webhook.js  # 设置 webhook 工具
├── package.json        # 依赖配置
├── vercel.json         # Vercel 配置
├── .env.example        # 环境变量示例
└── README.md           # 本文件
```

## 免费额度

Vercel Hobby 免费版：
- ✅ 每月 100GB 带宽
- ✅ 每月 1000 个构建小时
- ✅ 服务器less 函数 10 秒超时
- ✅ 足够个人使用

## 常见问题

### Q: 机器人不回复？

1. 检查 Token 是否正确
2. 确认 webhook 已设置
3. 查看 Vercel 日志

### Q: 如何更新代码？

```bash
# 修改代码后重新部署
vercel --prod
```

### Q: 如何查看日志？

在 Vercel 控制台 → 你的项目 → Functions → 查看日志

### Q: 可以接入其他 AI 吗？

可以！支持任何提供 API 的 AI 服务：
- OpenAI (GPT-4/GPT-3.5)
- Claude
- 文心一言
- 通义千问
- Gemini

## 进阶功能

- [ ] 图片处理
- [ ] 语音消息
- [ ] 内联键盘
- [ ] 群组管理
- [ ] 定时任务
- [ ] 用户数据存储

## 参考

- [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api)
- [Vercel Functions](https://vercel.com/docs/functions)
- [Telegram Bot API](https://core.telegram.org/bots/api)

---

有问题？在 Telegram 中向你的机器人发送反馈！
