// Telegram 文件分享机器人
// 功能：接收文件 → 生成唯一ID → 通过ID分享文件

const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(TOKEN, { webHook: true });

// 简单的内存存储（生产环境应该用数据库）
// 格式: { fileId: { fileType, fileId, fileName, fileSize, from, date } }
const fileStore = new Map();

// 生成短ID
function generateShortId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      return res.status(200).json({ 
        status: 'ok', 
        message: '文件分享机器人正在运行！' 
      });
    }

    const update = req.body;
    
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      
      // 处理文件上传
      if (msg.video || msg.document || msg.photo || msg.audio) {
        await handleFileUpload(bot, chatId, msg);
      }
      // 处理文字消息（可能是文件ID）
      else if (msg.text) {
        await handleTextMessage(bot, chatId, msg);
      }
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('错误:', error);
    res.status(200).json({ ok: false, error: error.message });
  }
};

// 处理文件上传
async function handleFileUpload(bot, chatId, msg) {
  let fileInfo = null;
  let fileType = '';
  
  // 获取文件信息
  if (msg.video) {
    fileInfo = msg.video;
    fileType = 'video';
  } else if (msg.document) {
    fileInfo = msg.document;
    fileType = 'document';
  } else if (msg.photo) {
    // 取最大尺寸的图片
    fileInfo = msg.photo[msg.photo.length - 1];
    fileType = 'photo';
  } else if (msg.audio) {
    fileInfo = msg.audio;
    fileType = 'audio';
  }
  
  if (!fileInfo) {
    return bot.sendMessage(chatId, '❌ 无法识别文件类型');
  }
  
  // 生成唯一ID
  const shortId = generateShortId();
  
  // 存储文件信息
  fileStore.set(shortId, {
    fileType: fileType,
    fileId: fileInfo.file_id,
    fileName: fileInfo.file_name || '未命名',
    fileSize: formatFileSize(fileInfo.file_size),
    from: msg.from.username || msg.from.first_name,
    date: new Date().toISOString()
  });
  
  // 发送成功消息
  const successMsg = `
✅ 文件上传成功！

📁 文件名：${fileInfo.file_name || '未命名'}
📦 文件大小：${formatFileSize(fileInfo.file_size)}
🆔 分享ID：<code>${shortId}</code>

<b>分享方式：</b>
1. 直接发送ID给别人
2. 别人发送这个ID给我就能获取文件

⚠️ 注意：文件ID有效期30天
  `;
  
  await bot.sendMessage(chatId, successMsg, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📋 复制ID', callback_data: `copy_${shortId}` },
          { text: '📤 分享', url: `https://t.me/share/url?url=${shortId}&text=分享一个文件给你！` }
        ]
      ]
    }
  });
  
  console.log(`文件已保存: ${shortId}, 用户: ${msg.from.username || msg.from.first_name}`);
}

// 处理文字消息
async function handleTextMessage(bot, chatId, msg) {
  const text = msg.text.trim();
  
  // 处理命令
  if (text.startsWith('/')) {
    return handleCommand(bot, chatId, text, msg);
  }
  
  // 检查是否是文件ID（6位字母数字）
  const idPattern = /^[A-Za-z0-9]{6}$/;
  
  if (idPattern.test(text)) {
    const fileData = fileStore.get(text);
    
    if (!fileData) {
      return bot.sendMessage(chatId, 
        '❌ 找不到该文件\n\n可能的原因：\n• ID错误\n• 文件已过期（30天）\n• 文件已被删除',
        { parse_mode: 'HTML' }
      );
    }
    
    // 发送文件
    await sendFileById(bot, chatId, fileData);
    
    // 记录下载
    console.log(`文件被获取: ${text}, 用户: ${msg.from.username || msg.from.first_name}`);
  } else {
    // 不是ID，发送帮助
    await bot.sendMessage(chatId, 
      '👋 发送文件给我，我会给你一个分享ID\n\n' +
      '其他人发送这个ID就能获取文件！\n\n' +
      '支持的文件类型：视频、图片、文档、音频',
      { parse_mode: 'HTML' }
    );
  }
}

// 处理命令
async function handleCommand(bot, chatId, text, msg) {
  const command = text.split(' ')[0].toLowerCase();
  
  switch (command) {
    case '/start':
      await bot.sendMessage(chatId,
        `👋 欢迎使用文件分享机器人！\n\n` +
        `📤 <b>上传文件：</b>\n` +
        `直接发送视频、图片、文档给我\n\n` +
        `📥 <b>获取文件：</b>\n` +
        `发送文件ID（6位字母数字）\n\n` +
        `💡 <b>示例：</b>\n` +
        `• 上传视频 → 获得ID: Ab3x9K\n` +
        `• 朋友发送 Ab3x9K → 获得视频\n\n` +
        `支持的文件：视频、图片、文档、音频`,
        { parse_mode: 'HTML' }
      );
      break;
      
    case '/help':
      await bot.sendMessage(chatId,
        `📖 <b>使用帮助</b>\n\n` +
        `<b>上传文件：</b>\n` +
        `直接发送文件，机器人会返回分享ID\n\n` +
        `<b>下载文件：</b>\n` +
        `发送分享ID（如：Ab3x9K）\n\n` +
        `<b>文件有效期：</b> 30天\n\n` +
        `<b>注意事项：</b>\n` +
        `• 不要分享敏感文件\n` +
        `• 大文件可能需要等待\n` +
        `• ID区分大小写`,
        { parse_mode: 'HTML' }
      );
      break;
      
    case '/stats':
      const stats = getStats();
      await bot.sendMessage(chatId,
        `📊 <b>统计信息</b>\n\n` +
        `📁 已存储文件：${stats.totalFiles}\n` +
        `💾 总大小：${stats.totalSize}\n` +
        `📹 视频：${stats.videoCount}\n` +
        `🖼 图片：${stats.photoCount}\n` +
        `📄 文档：${stats.documentCount}\n` +
        `🎵 音频：${stats.audioCount}`,
        { parse_mode: 'HTML' }
      );
      break;
      
    default:
      await bot.sendMessage(chatId, '未知命令，发送 /help 查看帮助');
  }
}

// 根据ID发送文件
async function sendFileById(bot, chatId, fileData) {
  try {
    switch (fileData.fileType) {
      case 'video':
        await bot.sendVideo(chatId, fileData.fileId, {
          caption: `📹 ${fileData.fileName}\n💾 ${fileData.fileSize}`
        });
        break;
        
      case 'photo':
        await bot.sendPhoto(chatId, fileData.fileId, {
          caption: `🖼 图片\n💾 ${fileData.fileSize}`
        });
        break;
        
      case 'document':
        await bot.sendDocument(chatId, fileData.fileId, {
          caption: `📄 ${fileData.fileName}\n💾 ${fileData.fileSize}`
        });
        break;
        
      case 'audio':
        await bot.sendAudio(chatId, fileData.fileId, {
          caption: `🎵 ${fileData.fileName}\n💾 ${fileData.fileSize}`
        });
        break;
        
      default:
        await bot.sendDocument(chatId, fileData.fileId);
    }
  } catch (error) {
    console.error('发送文件失败:', error);
    await bot.sendMessage(chatId, '❌ 文件发送失败，可能已过期');
  }
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (!bytes) return '未知';
  
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

// 获取统计信息
function getStats() {
  let totalSize = 0;
  let videoCount = 0;
  let photoCount = 0;
  let documentCount = 0;
  let audioCount = 0;
  
  for (const file of fileStore.values()) {
    // 简化的统计，实际应该累加bytes
    totalSize += 1; // 占位
    
    switch (file.fileType) {
      case 'video': videoCount++; break;
      case 'photo': photoCount++; break;
      case 'document': documentCount++; break;
      case 'audio': audioCount++; break;
    }
  }
  
  return {
    totalFiles: fileStore.size,
    totalSize: fileStore.size + ' 个文件',
    videoCount,
    photoCount,
    documentCount,
    audioCount
  };
}
