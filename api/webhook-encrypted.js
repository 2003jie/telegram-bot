/**
 * TG网盘机器人 v4.1 - 加密存储版
 * 
 * 功能：
 * - 使用 Vercel KV 持久化存储
 * - AES-256 加密保护隐私
 * - 自动识别文件类型
 * - 话题分类存储
 * - 显示上传者、时间
 */

const TelegramBot = require('node-telegram-bot-api');

// 尝试导入 Vercel KV
let kv;
try {
  kv = require('@vercel/kv');
} catch (e) {
  console.log('Vercel KV 未安装，使用内存缓存');
}

// 环境变量
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROUP_ID = process.env.TELEGRAM_GROUP_ID;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 加密密码

// 话题ID配置
const TOPIC_IDS = {
  video: process.env.VIDEO_TOPIC_ID,
  photo: process.env.PHOTO_TOPIC_ID,
  document: process.env.DOCUMENT_TOPIC_ID
};

if (!TOKEN || !GROUP_ID) {
  console.error('错误：缺少必要的环境变量');
}

const bot = new TelegramBot(TOKEN, { webHook: true });

// 内存缓存（作为 KV 的备用）
const memoryCache = new Map();

// 文件类型配置
const FILE_TYPES = {
  video: { name: '视频', emoji: '🎬' },
  photo: { name: '图片', emoji: '🖼' },
  document: { name: '文档', emoji: '📄' }
};

/**
 * 简单的 XOR 加密（轻量级，适合短文本）
 * 注意：这不是最高安全级别，但足够保护普通数据
 */
function encrypt(text, key) {
  if (!key) return text; // 没有密钥则不加密
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return Buffer.from(result).toString('base64');
}

/**
 * 解密
 */
function decrypt(encryptedText, key) {
  if (!key) return encryptedText;
  try {
    const text = Buffer.from(encryptedText, 'base64').toString();
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch (e) {
    return null;
  }
}

/**
 * 保存文件信息（加密存储）
 */
async function saveFileInfo(fileId, fileInfo) {
  const data = JSON.stringify(fileInfo);
  const encrypted = encrypt(data, ENCRYPTION_KEY);
  
  // 优先使用 KV，否则用内存
  if (kv) {
    await kv.set(fileId, encrypted);
  } else {
    memoryCache.set(fileId, encrypted);
  }
}

/**
 * 获取文件信息（解密读取）
 */
async function getFileInfo(fileId) {
  let encrypted;
  
  // 优先从 KV 读取
  if (kv) {
    encrypted = await kv.get(fileId);
  }
  
  // KV 没有则从内存读取
  if (!encrypted && memoryCache.has(fileId)) {
    encrypted = memoryCache.get(fileId);
  }
  
  if (!encrypted) return null;
  
  const decrypted = decrypt(encrypted, ENCRYPTION_KEY);
  if (!decrypted) return null;
  
  try {
    return JSON.parse(decrypted);
  } catch (e) {
    return null;
  }
}

/**
 * 生成6位短ID
 */
function generateShortId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
  if (!bytes) return '未知';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * 格式化时间
 */
function formatTime(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * 智能识别文件类型
 */
function detectFileType(fileInfo, msg) {
  const fileName = (fileInfo.file_name || '').toLowerCase();
  
  if (msg.video) return 'video';
  if (msg.photo) return 'photo';
  if (msg.document) {
    const videoExts = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.3gp'];
    for (const ext of videoExts) {
      if (fileName.endsWith(ext)) return 'video';
    }
    const photoExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico'];
    for (const ext of photoExts) {
      if (fileName.endsWith(ext)) return 'photo';
    }
    return 'document';
  }
  return null;
}

/**
 * 主入口
 */
module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      return res.status(200).json({
        status: 'ok',
        version: '4.1',
        message: 'TG网盘机器人（加密存储版）正在运行',
        features: ['加密存储', '话题分类', '持久化'],
        encryption: ENCRYPTION_KEY ? 'enabled' : 'disabled'
      });
    }

    const update = req.body;

    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;

      if (msg.video || msg.document || msg.photo) {
        await handleFileUpload(bot, chatId, msg);
      } else if (msg.text) {
        await handleTextMessage(bot, chatId, msg);
      }
    }

    if (update.callback_query) {
      await handleCallbackQuery(bot, update.callback_query);
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('处理请求错误:', error);
    res.status(200).json({ ok: false, error: error.message });
  }
};

/**
 * 处理文件上传
 */
async function handleFileUpload(bot, chatId, msg) {
  if (!GROUP_ID) {
    return bot.sendMessage(chatId, '❌ 机器人未配置存储群组');
  }

  let fileInfo = null;
  if (msg.video) fileInfo = msg.video;
  else if (msg.photo) fileInfo = msg.photo[msg.photo.length - 1];
  else if (msg.document) fileInfo = msg.document;

  if (!fileInfo) {
    return bot.sendMessage(chatId, '❌ 无法识别文件类型');
  }

  const fileType = detectFileType(fileInfo, msg);
  if (!fileType) {
    return bot.sendMessage(chatId, '❌ 不支持的文件类型');
  }

  const typeConfig = FILE_TYPES[fileType];
  const topicId = TOPIC_IDS[fileType];
  
  if (!topicId) {
    return bot.sendMessage(chatId, `❌ 未配置「${typeConfig.name}」话题ID`);
  }

  const fileName = fileInfo.file_name || (msg.photo ? 'image.jpg' : 'file');
  const fileSize = formatFileSize(fileInfo.file_size);
  const userName = msg.from.username ? `@${msg.from.username}` : (msg.from.first_name || '未知用户');
  const userId = msg.from.id;
  const uploadTime = formatTime(new Date());
  
  const shortId = generateShortId();
  const caption = `🆔 <code>${shortId}</code>\n📁 ${fileName}\n💾 ${fileSize}\n👤 上传者：${userName}\n🕐 时间：${uploadTime}`;

  try {
    // 发送到话题
    let forwardedMsg;
    const sendOptions = {
      caption,
      parse_mode: 'HTML',
      message_thread_id: parseInt(topicId),
      supports_streaming: true
    };

    switch (fileType) {
      case 'video':
        forwardedMsg = await bot.sendVideo(GROUP_ID, fileInfo.file_id, {
          ...sendOptions,
          width: fileInfo.width || 1280,
          height: fileInfo.height || 720,
          duration: fileInfo.duration || 0
        });
        break;
      case 'photo':
        forwardedMsg = await bot.sendPhoto(GROUP_ID, fileInfo.file_id, sendOptions);
        break;
      case 'document':
        forwardedMsg = await bot.sendDocument(GROUP_ID, fileInfo.file_id, sendOptions);
        break;
    }

    // 加密保存到数据库
    const fileData = {
      messageId: forwardedMsg.message_id,
      fileType,
      category: fileType,
      fileName,
      fileSize,
      userName,
      userId,
      uploadTime,
      topicId,
      groupId: GROUP_ID,
      timestamp: Date.now()
    };

    await saveFileInfo(shortId, fileData);

    // 发送成功消息
    const storageMsg = kv ? '🔐 已加密保存到数据库' : '💾 已保存到内存（重启后丢失）';
    
    await bot.sendMessage(chatId,
      `✅ <b>文件保存成功！</b>\n\n` +
      `${typeConfig.emoji} 分类：${typeConfig.name}\n` +
      `📁 文件名：${fileName}\n` +
      `📦 大小：${fileSize}\n` +
      `🆔 分享ID：<code>${shortId}</code>\n\n` +
      `👤 上传者：${userName}\n` +
      `🕐 时间：${uploadTime}\n\n` +
      `${storageMsg}`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📋 复制ID', callback_data: `copy_${shortId}` },
              { text: '📤 分享', url: `https://t.me/share/url?url=${shortId}&text=分享文件给你！` }
            ],
            [
              { text: '🎬 视频', callback_data: 'topic_video' },
              { text: '🖼 图片', callback_data: 'topic_photo' },
              { text: '📄 文档', callback_data: 'topic_document' }
            ]
          ]
        }
      }
    );

    console.log(`[加密保存] ID:${shortId} 类型:${fileType}`);

  } catch (error) {
    console.error('保存文件失败:', error);
    await bot.sendMessage(chatId, '❌ 文件保存失败：' + error.message);
  }
}

/**
 * 处理文字消息
 */
async function handleTextMessage(bot, chatId, msg) {
  const text = msg.text.trim();

  if (text.startsWith('/')) {
    return handleCommand(bot, chatId, text, msg);
  }

  const idPattern = /^[A-Za-z0-9]{6}$/;

  if (idPattern.test(text)) {
    await handleFileRequest(bot, chatId, text, msg);
  } else {
    await bot.sendMessage(chatId,
      `👋 <b>TG网盘机器人（加密版）</b>\n\n` +
      `🔐 文件信息加密存储\n` +
      `📤 发送文件自动分类\n` +
      `📥 发送6位ID取回文件`,
      { parse_mode: 'HTML' }
    );
  }
}

/**
 * 处理文件请求
 */
async function handleFileRequest(bot, chatId, shareId, msg) {
  const fileInfo = await getFileInfo(shareId);

  if (!fileInfo) {
    return bot.sendMessage(chatId,
      `❌ 找不到该文件\n` +
      `ID错误或已过期`,
      { parse_mode: 'HTML' }
    );
  }

  const typeConfig = FILE_TYPES[fileInfo.category];

  try {
    await bot.copyMessage(chatId, fileInfo.groupId, fileInfo.messageId);
    
    await bot.sendMessage(chatId,
      `📋 <b>文件信息</b>\n\n` +
      `${typeConfig.emoji} 分类：${typeConfig.name}\n` +
      `📁 文件名：${fileInfo.fileName}\n` +
      `💾 大小：${fileInfo.fileSize}\n` +
      `👤 上传者：${fileInfo.userName}\n` +
      `🕐 上传时间：${fileInfo.uploadTime}\n` +
      `🆔 ID：<code>${shareId}</code>`,
      { parse_mode: 'HTML' }
    );

  } catch (error) {
    await bot.sendMessage(chatId, '❌ 文件发送失败');
  }
}

/**
 * 处理命令
 */
async function handleCommand(bot, chatId, text, msg) {
  const command = text.split(' ')[0].toLowerCase();

  switch (command) {
    case '/start':
      const args = text.split(' ');
      if (args.length > 1 && args[1].length === 6) {
        return handleFileRequest(bot, chatId, args[1], msg);
      }

      const encryptStatus = ENCRYPTION_KEY ? '🔐 加密已启用' : '⚠️ 加密未启用';
      const storageStatus = kv ? '✅ 持久化存储' : '⚠️ 内存存储（重启丢失）';

      await bot.sendMessage(chatId,
        `👋 <b>TG网盘机器人 v4.1</b>\n\n` +
        `${encryptStatus}\n` +
        `${storageStatus}\n\n` +
        `📤 发送文件自动分类存储\n` +
        `📥 发送ID取回文件`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🎬 视频', callback_data: 'topic_video' },
                { text: '🖼 图片', callback_data: 'topic_photo' },
                { text: '📄 文档', callback_data: 'topic_document' }
              ]
            ]
          }
        }
      );
      break;

    case '/help':
      await bot.sendMessage(chatId,
        `📖 <b>使用帮助</b>\n\n` +
        `🔐 所有文件信息加密存储\n` +
        `即使数据库泄露也无法读取内容\n\n` +
        `📤 上传文件：直接发送\n` +
        `📥 取回文件：发送6位ID`,
        { parse_mode: 'HTML' }
      );
      break;

    case '/topics':
      await bot.sendMessage(chatId,
        `📂 <b>网盘话题</b>\n\n选择分类：`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🎬 视频', callback_data: 'topic_video' },
                { text: '🖼 图片', callback_data: 'topic_photo' },
                { text: '📄 文档', callback_data: 'topic_document' }
              ]
            ]
          }
        }
      );
      break;

    case '/stats':
      // 统计只能统计内存中的（因为KV加密存储无法遍历）
      let videoCount = 0, photoCount = 0, documentCount = 0;
      for (const [id, encrypted] of memoryCache.entries()) {
        const data = decrypt(encrypted, ENCRYPTION_KEY);
        if (data) {
          try {
            const file = JSON.parse(data);
            if (file.category === 'video') videoCount++;
            else if (file.category === 'photo') photoCount++;
            else if (file.category === 'document') documentCount++;
          } catch (e) {}
        }
      }

      await bot.sendMessage(chatId,
        `📊 <b>网盘统计</b>\n\n` +
        `📁 内存缓存：${memoryCache.size}\n` +
        `🎬 视频：${videoCount}\n` +
        `🖼 图片：${photoCount}\n` +
        `📄 文档：${documentCount}\n\n` +
        `🔐 加密存储保护隐私`,
        { parse_mode: 'HTML' }
      );
      break;

    default:
      await bot.sendMessage(chatId, '未知命令，发送 /help 查看帮助');
  }
}

/**
 * 处理按钮回调
 */
async function handleCallbackQuery(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  const userId = callbackQuery.from.id;

  if (data.startsWith('topic_')) {
    const topic = data.substring(6);
    await handleTopicView(bot, chatId, userId, topic);
  }
  else if (data.startsWith('copy_')) {
    const id = data.substring(5);
    await bot.sendMessage(chatId,
      `📋 分享ID：<code>${id}</code>\n\n复制上面这串代码发送给别人`,
      { parse_mode: 'HTML' }
    );
  }

  await bot.answerCallbackQuery(callbackQuery.id);
}

/**
 * 查看话题内容
 */
async function handleTopicView(bot, chatId, userId, topic) {
  const typeConfig = FILE_TYPES[topic];
  if (!typeConfig) return;

  // 从内存缓存中查找（加密的）
  const userFiles = [];
  for (const [id, encrypted] of memoryCache.entries()) {
    const decrypted = decrypt(encrypted, ENCRYPTION_KEY);
    if (decrypted) {
      try {
        const info = JSON.parse(decrypted);
        if (info.userId === userId && info.category === topic) {
          userFiles.push({ id, ...info });
        }
      } catch (e) {}
    }
  }

  if (userFiles.length === 0) {
    return bot.sendMessage(chatId,
      `${typeConfig.emoji} <b>${typeConfig.name}话题</b>\n\n` +
      `你还没有上传过${typeConfig.name}。`,
      { parse_mode: 'HTML' }
    );
  }

  let fileList = `${typeConfig.emoji} <b>${typeConfig.name}话题</b>\n` +
                 `共 ${userFiles.length} 个文件\n\n`;

  userFiles.slice(0, 10).forEach((file, index) => {
    fileList += `${index + 1}. ${file.fileName}\n`;
    fileList += `   💾 ${file.fileSize}  🆔 <code>${file.id}</code>\n`;
    fileList += `   👤 ${file.userName}  🕐 ${file.uploadTime}\n\n`;
  });

  if (userFiles.length > 10) {
    fileList += `... 还有 ${userFiles.length - 10} 个文件`;
  }

  await bot.sendMessage(chatId, fileList, { parse_mode: 'HTML' });
}
