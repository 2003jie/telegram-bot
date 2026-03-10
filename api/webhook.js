// Telegram Bot Webhook Handler
const TelegramBot = require('node-telegram-bot-api');

// 从环境变量获取 Token
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// 创建 bot 实例（不使用 polling，使用 webhook）
const bot = new TelegramBot(TOKEN, { webHook: true });

module.exports = async (req, res) => {
  try {
    // 只处理 POST 请求
    if (req.method !== 'POST') {
      return res.status(200).json({ 
        status: 'ok', 
        message: 'Telegram Bot Webhook is running!' 
      });
    }

    // 处理 Telegram 更新
    const update = req.body;
    
    // 处理消息
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const text = msg.text || '';
      
      console.log('收到消息:', text, '来自:', msg.from?.username);

      // 处理命令
      if (text.startsWith('/')) {
        await handleCommand(bot, chatId, text, msg);
      } else {
        // 普通消息 - 使用 AI 回复
        await handleAIResponse(bot, chatId, text, msg);
      }
    }

    // 处理回调查询（按钮点击）
    if (update.callback_query) {
      await handleCallbackQuery(bot, update.callback_query);
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('处理错误:', error);
    res.status(200).json({ ok: false, error: error.message });
  }
};

// 处理命令
async function handleCommand(bot, chatId, text, msg) {
  const command = text.split(' ')[0].toLowerCase();
  
  switch (command) {
    case '/start':
      await bot.sendMessage(chatId, 
        `👋 你好 ${msg.from?.first_name || '朋友'}!\n\n` +
        `我是你的 AI 助手机器人。\n\n` +
        `可用命令:\n` +
        `/start - 开始使用\n` +
        `/help - 查看帮助\n` +
        `/ai [问题] - 问 AI 问题\n` +
        `/status - 查看状态\n\n` +
        `直接发送消息，我会用 AI 回复你！`
      );
      break;
      
    case '/help':
      await bot.sendMessage(chatId,
        `📖 使用帮助\n\n` +
        `1. 直接发送消息 - 我会用 AI 智能回复\n` +
        `2. /ai [问题] - 专门问 AI 问题\n` +
        `3. 支持文字、图片等多种消息\n\n` +
        `提示: 我可以帮你写文章、编程、翻译、解答问题等！`
      );
      break;
      
    case '/ai':
      const question = text.replace('/ai', '').trim();
      if (question) {
        await handleAIResponse(bot, chatId, question, msg);
      } else {
        await bot.sendMessage(chatId, '请输入问题，例如: /ai 什么是人工智能？');
      }
      break;
      
    case '/status':
      await bot.sendMessage(chatId, 
        `✅ 机器人运行正常\n` +
        `🕐 时间: ${new Date().toLocaleString('zh-CN')}\n` +
        `👤 用户: ${msg.from?.username || '未知'}\n` +
        `🆔 ID: ${msg.from?.id}`
      );
      break;
      
    default:
      await bot.sendMessage(chatId, '未知命令，输入 /help 查看帮助');
  }
}

// AI 回复处理（模拟，实际可以接入 OpenAI、Claude 等）
async function handleAIResponse(bot, chatId, text, msg) {
  // 显示"正在输入"状态
  await bot.sendChatAction(chatId, 'typing');
  
  // 这里可以接入真实的 AI API
  // 比如 OpenAI、Claude、文心一言等
  
  // 简单示例回复
  const responses = [
    `🤖 我收到了你的消息: "${text}"\n\n` +
    `目前这是演示版本。你可以:\n` +
    `1. 接入 OpenAI API 获得 GPT-4 回复\n` +
    `2. 接入 Claude API\n` +
    `3. 接入其他 AI 服务\n\n` +
    `修改 api/webhook.js 中的 handleAIResponse 函数即可！`,
    
    `👋 你好！你说: "${text}"\n\n` +
    `💡 提示: 要启用真正的 AI 回复，请:\n` +
    `1. 获取 OpenAI API Key\n` +
    `2. 在 Vercel 环境变量中添加 OPENAI_API_KEY\n` +
    `3. 修改代码调用 OpenAI API`,
    
    `📝 收到: "${text}"\n\n` +
    `这是一个基础框架，你可以:\n` +
    `• 添加更多命令\n` +
    `• 接入数据库\n` +
    `• 添加图片处理\n` +
    `• 集成更多功能`
  ];
  
  const randomResponse = responses[Math.floor(Math.random() * responses.length)];
  
  await bot.sendMessage(chatId, randomResponse, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🔄 重新生成', callback_data: 'regenerate' },
          { text: '👍 有用', callback_data: 'helpful' }
        ],
        [
          { text: '❓ 帮助', callback_data: 'help' }
        ]
      ]
    }
  });
}

// 处理回调查询
async function handleCallbackQuery(bot, callbackQuery) {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  
  switch (data) {
    case 'regenerate':
      await bot.answerCallbackQuery(callbackQuery.id, { text: '正在重新生成...' });
      // 重新生成回复
      await handleAIResponse(bot, chatId, '重新生成', callbackQuery.from);
      break;
      
    case 'helpful':
      await bot.answerCallbackQuery(callbackQuery.id, { text: '感谢反馈！' });
      break;
      
    case 'help':
      await bot.answerCallbackQuery(callbackQuery.id, { text: '查看帮助' });
      await bot.sendMessage(chatId, '输入 /help 查看完整帮助');
      break;
      
    default:
      await bot.answerCallbackQuery(callbackQuery.id);
  }
}
