/**
 * TG网盘机器人 v4.0 - Telegram话题版
 * 
 * 功能：
 * - 使用Telegram话题实现真正文件夹分类
 * - 自动识别文件类型
 * - 显示上传者、上传时间
 * - 视频/图片自动显示缩略图
 * - 6位短ID分享
 */

const TelegramBot = require('node-telegram-bot-api');

// 环境变量
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROUP_ID = process.env.TELEGRAM_GROUP_ID;

// 话题ID配置（在群组中创建话题后获取）
const TOPIC_IDS = {
  video: process.env.VIDEO_TOPIC_ID,      // 视频话题ID
  photo: process.env.PHOTO_TOPIC_ID,      // 图片话题ID
  document: process.env.DOCUMENT_TOPIC_ID // 文档话题ID
};

if (!TOKEN || !GROUP_ID) {
  console.error('错误：缺少必要的环境变量');
}

const bot = new TelegramBot(TOKEN, { webHook: true });

// 内存缓存
const fileCache = new Map();

// 文件类型配置
const FILE_TYPES = {
  video: { name: '视频', emoji: '🎬', icon: '🎬' },
  photo: { name: '图片', emoji: '🖼', icon: '🖼' },
  document: { name: '文档', emoji: '📄', icon: '📄' }
};

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
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

/**
 * 智能识别文件类型
 */
function detectFileType(fileInfo, msg) {
  const fileName = (fileInfo.file_name || '').toLowerCase();
  const mimeType = (fileInfo.mime_type || '').toLowerCase();
  
  // 根据Telegram消息类型判断
  if (msg.video) return 'video';
  if (msg.photo) return 'photo';
  if (msg.document) {
    // 视频文件后缀
    const videoExts = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.3gp'];
    for (const ext of videoExts) {
      if (fileName.endsWith(ext)) return 'video';
    }
    // 图片文件后缀
    const photoExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico'];
    for (const ext of photoExts) {
      if (fileName.endsWith(ext)) return 'photo';
    }
    // 默认文档
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
        version: '4.0',
        message: 'TG网盘机器人（话题版）正在运行',
        features: ['话题分类', '自动识别', '上传信息', '缩略图'],
        topics: Object.keys(FILE_TYPES)
      });
    }

    const update = req.body;

    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;

      // 处理文件上传
      if (msg.video || msg.document || msg.photo) {
        await handleFileUpload(bot, chatId, msg);
      }
      // 处理文字消息
      else if (msg.text) {
        await handleTextMessage(bot, chatId, msg);
      }
    }

    // 处理按钮回调
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
 * 处理文件上传 - 发送到对应话题
 */
async function handleFileUpload(bot, chatId, msg) {
  if (!GROUP_ID) {
    return bot.sendMessage(chatId, '❌ 机器人未配置存储群组');
  }

  let fileInfo = null;

  // 获取文件信息
  if (msg.video) {
    fileInfo = msg.video;
  } else if (msg.photo) {
    fileInfo = msg.photo[msg.photo.length - 1];
  } else if (msg.document) {
    fileInfo = msg.document;
  }

  if (!fileInfo) {
    return bot.sendMessage(chatId, '❌ 无法识别文件类型');
  }

  // 智能识别文件类型
  const fileType = detectFileType(fileInfo, msg);
  
  if (!fileType) {
    return bot.sendMessage(chatId, '❌ 不支持的文件类型');
  }

  const typeConfig = FILE_TYPES[fileType];
  const topicId = TOPIC_IDS[fileType];
  
  // 检查话题ID是否配置
  if (!topicId) {
    return bot.sendMessage(chatId, 
      `❌ 未配置「${typeConfig.name}」话题ID\n` +
      `请在环境变量中设置 ${fileType.toUpperCase()}_TOPIC_ID`
    );
  }

  const fileName = fileInfo.file_name || (msg.photo ? 'image.jpg' : 'file');
  const fileSize = formatFileSize(fileInfo.file_size);
  const userName = msg.from.username ? `@${msg.from.username}` : (msg.from.first_name || '未知用户');
  const userId = msg.from.id;
  const uploadTime = formatTime(new Date());
  
  const shortId = generateShortId();
  
  // 构建Caption（包含所有信息）
  const caption = `🆔 <code>${shortId}</code>\n` +
                  `📁 ${fileName}\n` +
                  `💾 ${fileSize}\n` +
                  `👤 上传者：${userName}\n` +
                  `🕐 时间：${uploadTime}`;

  try {
    // 发送选项 - 指定话题ID
    const sendOptions = {
      caption,
      parse_mode: 'HTML',
      message_thread_id: parseInt(topicId) // 话题ID
    };

    // 根据类型发送到对应话题
    let forwardedMsg;
    
    switch (fileType) {
      case 'video':
        // 视频会自动显示缩略图
        forwardedMsg = await bot.sendVideo(GROUP_ID, fileInfo.file_id, sendOptions);
        break;
      case 'photo':
        // 图片会自动显示缩略图
        forwardedMsg = await bot.sendPhoto(GROUP_ID, fileInfo.file_id, sendOptions);
        break;
      case 'document':
        // 文档部分类型也有缩略图
        forwardedMsg = await bot.sendDocument(GROUP_ID, fileInfo.file_id, sendOptions);
        break;
    }

    // 保存到缓存
    fileCache.set(shortId, {
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
    });

    // 发送成功消息给用户
    const successMsg = 
      `✅ <b>文件保存成功！</b>\n\n` +
      `${typeConfig.emoji} 分类：${typeConfig.name}\n` +
      `📁 文件名：${fileName}\n` +
      `📦 大小：${fileSize}\n` +
      `🆔 分享ID：<code>${shortId}</code>\n\n` +
      `👤 上传者：${userName}\n` +
      `🕐 时间：${uploadTime}\n\n` +
      `<b>✨ 已保存到「${typeConfig.name}」话题</b>`;

    await bot.sendMessage(chatId, successMsg, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📋 复制ID', callback_data: `copy_${shortId}` },
            { text: '📤 分享', url: `https://t.me/share/url?url=${shortId}&text=分享文件给你！` }
          ],
          [
            { text: '🎬 视频话题', callback_data: 'topic_video' },
            { text: '🖼 图片话题', callback_data: 'topic_photo' },
            { text: '📄 文档话题', callback_data: 'topic_document' }
          ]
        ]
      }
    });

    console.log(`[话题保存] ID:${shortId} 类型:${fileType} 话题:${topicId} 用户:${userName}`);

  } catch (error) {
    console.error('保存文件失败:', error);
    await bot.sendMessage(chatId, 
      '❌ 文件保存失败\n\n' +
      '可能原因：\n' +
      '1. 机器人不是群组管理员\n' +
      '2. 话题ID配置错误\n' +
      '3. 话题不存在'
    );
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

  // 检查是否是文件ID（6位）
  const idPattern = /^[A-Za-z0-9]{6}$/;

  if (idPattern.test(text)) {
    await handleFileRequest(bot, chatId, text, msg);
  } else {
    await bot.sendMessage(chatId,
      `👋 <b>欢迎使用TG网盘机器人！</b>\n\n` +
      `📤 发送文件自动分类到话题\n` +
      `📥 发送6位ID取回文件\n\n` +
      `🎬 视频话题 🖼 图片话题 📄 文档话题`,
      { parse_mode: 'HTML' }
    );
  }
}

/**
 * 处理文件请求
 */
async function handleFileRequest(bot, chatId, shareId, msg) {
  const fileInfo = fileCache.get(shareId);

  if (!fileInfo) {
    return bot.sendMessage(chatId,
      `❌ 找不到该文件\n` +
      `ID可能错误或已过期`,
      { parse_mode: 'HTML' }
    );
  }

  const typeConfig = FILE_TYPES[fileInfo.category];

  try {
    // 从原话题复制文件
    await bot.copyMessage(chatId, fileInfo.groupId, fileInfo.messageId);
    
    // 发送文件信息
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
    console.error('发送文件失败:', error);
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

      await bot.sendMessage(chatId,
        `👋 <b>TG网盘机器人 v4.0</b>\n\n` +
        `📁 <b>话题分类存储</b>\n` +
        `🎬 视频 → 视频话题\n` +
        `🖼 图片 → 图片话题\n` +
        `📄 文档 → 文档话题\n\n` +
        `📋 显示上传者、时间、缩略图\n` +
        `🔍 发送6位ID取回文件`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🎬 视频话题', callback_data: 'topic_video' },
                { text: '🖼 图片话题', callback_data: 'topic_photo' },
                { text: '📄 文档话题', callback_data: 'topic_document' }
              ]
            ]
          }
        }
      );
      break;

    case '/help':
      await bot.sendMessage(chatId,
        `📖 <b>使用帮助</b>\n\n` +
        `<b>上传文件：</b>\n` +
        `直接发送，自动分类到对应话题\n\n` +
        `<b>文件信息：</b>\n` +
        `• 上传者\n` +
        `• 上传时间\n` +
        `• 缩略图（视频/图片）\n\n` +
        `<b>取回文件：</b>\n` +
        `发送分享ID`,
        { parse_mode: 'HTML' }
      );
      break;

    case '/topics':
      await bot.sendMessage(chatId,
        `📂 <b>网盘话题</b>\n\n` +
        `点击跳转到对应话题：`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🎬 视频话题', url: `https://t.me/c/${GROUP_ID.replace('-100', '')}/${TOPIC_IDS.video}` },
                { text: '🖼 图片话题', url: `https://t.me/c/${GROUP_ID.replace('-100', '')}/${TOPIC_IDS.photo}` }
              ],
              [
                { text: '📄 文档话题', url: `https://t.me/c/${GROUP_ID.replace('-100', '')}/${TOPIC_IDS.document}` }
              ]
            ]
          }
        }
      );
      break;

    case '/stats':
      const stats = getStats();
      await bot.sendMessage(chatId,
        `📊 <b>网盘统计</b>\n\n` +
        `📁 总计：${stats.totalFiles} 个文件\n` +
        `🎬 视频：${stats.videoCount} 个\n` +
        `🖼 图片：${stats.photoCount} 个\n` +
        `📄 文档：${stats.documentCount} 个`,
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

  const userFiles = [];
  for (const [id, info] of fileCache.entries()) {
    if (info.userId === userId && info.category === topic) {
      userFiles.push({ id, ...info });
    }
  }

  // 生成话题链接
  const topicId = TOPIC_IDS[topic];
  const groupLink = GROUP_ID.replace('-100', '');
  const topicLink = topicId ? `https://t.me/c/${groupLink}/${topicId}` : null;

  if (userFiles.length === 0) {
    const msg = 
      `${typeConfig.emoji} <b>${typeConfig.name}话题</b>\n\n` +
      `你还没有上传过${typeConfig.name}。\n\n`;
    
    const keyboard = topicLink ? {
      inline_keyboard: [[{ text: `📂 进入${typeConfig.name}话题`, url: topicLink }]]
    } : undefined;

    return bot.sendMessage(chatId, msg, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
  }

  let fileList = 
    `${typeConfig.emoji} <b>${typeConfig.name}话题</b>\n` +
    `共 ${userFiles.length} 个文件\n\n`;

  userFiles.slice(0, 10).forEach((file, index) => {
    fileList += `${index + 1}. ${file.fileName}\n`;
    fileList += `   💾 ${file.fileSize}  🆔 <code>${file.id}</code>\n`;
    fileList += `   👤 ${file.userName}  🕐 ${file.uploadTime}\n\n`;
  });

  if (userFiles.length > 10) {
    fileList += `... 还有 ${userFiles.length - 10} 个文件`;
  }

  const keyboard = topicLink ? {
    inline_keyboard: [
      [{ text: `📂 进入${typeConfig.name}话题查看全部`, url: topicLink }],
      [
        { text: '🎬 视频', callback_data: 'topic_video' },
        { text: '🖼 图片', callback_data: 'topic_photo' },
        { text: '📄 文档', callback_data: 'topic_document' }
      ]
    ]
  } : {
    inline_keyboard: [
      [
        { text: '🎬 视频', callback_data: 'topic_video' },
        { text: '🖼 图片', callback_data: 'topic_photo' },
        { text: '📄 文档', callback_data: 'topic_document' }
      ]
    ]
  };

  await bot.sendMessage(chatId, fileList, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

/**
 * 获取统计
 */
function getStats() {
  let videoCount = 0, photoCount = 0, documentCount = 0;

  for (const file of fileCache.values()) {
    switch (file.category) {
      case 'video': videoCount++; break;
      case 'photo': photoCount++; break;
      case 'document': documentCount++; break;
    }
  }

  return {
    totalFiles: fileCache.size,
    videoCount,
    photoCount,
    documentCount
  };
}
