/**
 * TG网盘机器人 v3.0
 * 使用 Telegram 私有群组作为存储，支持分类管理
 * 
 * 功能：
 * - 文件上传（视频/图片/文档/音频/语音）
 * - 分类选择（5个文件夹）
 * - 6位短ID分享
 * - ID取回文件
 * - 文件夹浏览
 * - 存储统计
 */

const TelegramBot = require('node-telegram-bot-api');

// 环境变量配置
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROUP_ID = process.env.TELEGRAM_GROUP_ID;

if (!TOKEN || !GROUP_ID) {
  console.error('错误：缺少必要的环境变量 TELEGRAM_BOT_TOKEN 或 TELEGRAM_GROUP_ID');
}

const bot = new TelegramBot(TOKEN, { webHook: true });

// 内存缓存（重启后丢失，但文件在群组中永久保存）
const fileCache = new Map();
const userPendingFiles = new Map();

// 文件分类配置
const FILE_CATEGORIES = {
  video: { name: '视频', emoji: '🎬' },
  photo: { name: '图片', emoji: '🖼' },
  document: { name: '文档', emoji: '📄' },
  audio: { name: '音频', emoji: '🎵' },
  voice: { name: '语音', emoji: '🎤' }
};

/**
 * 生成分类选择键盘
 */
function getCategoryKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🎬 视频', callback_data: 'cat_video' },
        { text: '🖼 图片', callback_data: 'cat_photo' }
      ],
      [
        { text: '📄 文档', callback_data: 'cat_document' },
        { text: '🎵 音频', callback_data: 'cat_audio' }
      ],
      [
        { text: '🎤 语音', callback_data: 'cat_voice' }
      ]
    ]
  };
}

/**
 * 生成文件夹菜单键盘
 */
function getFolderKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🎬 视频文件夹', callback_data: 'folder_video' },
        { text: '🖼 图片文件夹', callback_data: 'folder_photo' }
      ],
      [
        { text: '📄 文档文件夹', callback_data: 'folder_document' },
        { text: '🎵 音频文件夹', callback_data: 'folder_audio' }
      ],
      [
        { text: '🎤 语音文件夹', callback_data: 'folder_voice' },
        { text: '📂 全部文件', callback_data: 'folder_all' }
      ]
    ]
  };
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
 * 主入口 - Vercel Serverless Function
 */
module.exports = async (req, res) => {
  try {
    // GET 请求返回状态信息
    if (req.method !== 'POST') {
      return res.status(200).json({
        status: 'ok',
        version: '3.0',
        message: 'TG网盘机器人正在运行',
        features: ['文件上传', '分类管理', 'ID分享', '文件夹浏览'],
        storage: 'Telegram群组永久存储'
      });
    }

    const update = req.body;

    // 处理消息
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;

      // 文件上传
      if (msg.video || msg.document || msg.photo || msg.audio || msg.voice) {
        await handleFileUpload(bot, chatId, msg);
      }
      // 文字消息
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
 * 处理文件上传 - 第一步：让用户选择分类
 */
async function handleFileUpload(bot, chatId, msg) {
  // 检查配置
  if (!GROUP_ID) {
    return bot.sendMessage(chatId, '❌ 机器人未配置存储群组，请联系管理员设置 TELEGRAM_GROUP_ID');
  }

  let fileInfo = null;
  let fileType = '';

  // 识别文件类型
  if (msg.video) {
    fileInfo = msg.video;
    fileType = 'video';
  } else if (msg.document) {
    fileInfo = msg.document;
    fileType = 'document';
  } else if (msg.photo) {
    fileInfo = msg.photo[msg.photo.length - 1];
    fileType = 'photo';
  } else if (msg.audio) {
    fileInfo = msg.audio;
    fileType = 'audio';
  } else if (msg.voice) {
    fileInfo = msg.voice;
    fileType = 'voice';
  }

  if (!fileInfo) {
    return bot.sendMessage(chatId, '❌ 无法识别文件类型，支持的类型：视频、图片、文档、音频、语音');
  }

  const fileName = fileInfo.file_name ||
    (fileType === 'photo' ? 'image.jpg' :
      fileType === 'voice' ? 'voice.ogg' : 'file');
  const fileSize = formatFileSize(fileInfo.file_size);

  // 保存待处理文件信息
  userPendingFiles.set(msg.from.id, {
    fileId: fileInfo.file_id,
    fileName,
    fileSize,
    fileType,
    userName: msg.from.username || msg.from.first_name || '用户' + msg.from.id,
    userId: msg.from.id,
    chatId
  });

  // 询问分类
  const typeNames = { video: '视频', photo: '图片', document: '文档', audio: '音频', voice: '语音' };

  await bot.sendMessage(chatId,
    `📤 <b>文件接收成功</b>\n\n` +
    `📁 文件名：${fileName}\n` +
    `📦 大小：${fileSize}\n` +
    `🤖 自动识别：${typeNames[fileType] || '文件'}\n\n` +
    `请选择保存的文件夹：`,
    {
      parse_mode: 'HTML',
      reply_markup: getCategoryKeyboard()
    }
  );
}

/**
 * 处理分类选择 - 第二步：保存到群组
 */
async function handleCategorySelection(bot, chatId, userId, category) {
  const pendingFile = userPendingFiles.get(userId);

  if (!pendingFile) {
    return bot.sendMessage(chatId, '❌ 文件已过期，请重新上传');
  }

  const catConfig = FILE_CATEGORIES[category];
  if (!catConfig) {
    return bot.sendMessage(chatId, '❌ 无效的分类');
  }

  const shortId = generateShortId();
  const caption = `🆔 ${shortId} | ${catConfig.emoji} ${catConfig.name}\n` +
    `📁 ${pendingFile.fileName}\n` +
    `💾 ${pendingFile.fileSize}\n` +
    `👤 ${pendingFile.userName}`;

  try {
    // 转发文件到存储群组
    let forwardedMsg;
    switch (pendingFile.fileType) {
      case 'video':
        forwardedMsg = await bot.sendVideo(GROUP_ID, pendingFile.fileId, { caption });
        break;
      case 'photo':
        forwardedMsg = await bot.sendPhoto(GROUP_ID, pendingFile.fileId, { caption });
        break;
      case 'document':
        forwardedMsg = await bot.sendDocument(GROUP_ID, pendingFile.fileId, { caption });
        break;
      case 'audio':
        forwardedMsg = await bot.sendAudio(GROUP_ID, pendingFile.fileId, { caption });
        break;
      case 'voice':
        forwardedMsg = await bot.sendVoice(GROUP_ID, pendingFile.fileId, { caption });
        break;
    }

    // 保存到缓存
    fileCache.set(shortId, {
      messageId: forwardedMsg.message_id,
      fileType: pendingFile.fileType,
      category,
      fileName: pendingFile.fileName,
      fileSize: pendingFile.fileSize,
      userName: pendingFile.userName,
      userId: userId,
      timestamp: Date.now()
    });

    // 清除待处理状态
    userPendingFiles.delete(userId);

    // 发送成功消息
    await bot.sendMessage(chatId,
      `✅ <b>文件保存成功！</b>\n\n` +
      `${catConfig.emoji} 文件夹：${catConfig.name}\n` +
      `📁 文件名：${pendingFile.fileName}\n` +
      `📦 大小：${pendingFile.fileSize}\n` +
      `🆔 分享ID：<code>${shortId}</code>\n\n` +
      `<b>分享方式：</b>\n` +
      `• 直接发送ID给别人\n` +
      `• 别人发送ID给我就能获取文件\n\n` +
      `<b>✨ 文件永久保存在「${catConfig.name}」文件夹</b>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📋 复制ID', callback_data: `copy_${shortId}` },
              { text: '📤 分享', url: `https://t.me/share/url?url=${shortId}&text=分享文件给你！` }
            ],
            [{ text: '📂 打开网盘', callback_data: 'open_folder' }]
          ]
        }
      }
    );

    console.log(`[保存成功] ID:${shortId} 分类:${category} 用户:${pendingFile.userName}`);

  } catch (error) {
    console.error('保存文件失败:', error);
    await bot.sendMessage(chatId, '❌ 文件保存失败，请确保：\n1. 机器人是群组管理员\n2. 群组ID配置正确\n3. 群组存在且机器人已在群内');
    userPendingFiles.delete(userId);
  }
}

/**
 * 处理文字消息
 */
async function handleTextMessage(bot, chatId, msg) {
  const text = msg.text.trim();

  // 处理命令
  if (text.startsWith('/')) {
    return handleCommand(bot, chatId, text, msg);
  }

  // 检查是否是文件ID（6位字母数字）
  const idPattern = /^[A-Za-z0-9]{6}$/;

  if (idPattern.test(text)) {
    await handleFileRequest(bot, chatId, text, msg);
  } else {
    await bot.sendMessage(chatId,
      `👋 <b>欢迎使用TG网盘机器人！</b>\n\n` +
      `📤 <b>上传文件：</b>直接发送文件，选择分类\n` +
      `📥 <b>获取文件：</b>发送6位分享ID\n` +
      `📂 <b>浏览网盘：</b>发送 /folder 查看分类\n\n` +
      `支持的文件：视频 🎬、图片 🖼、文档 📄、音频 🎵、语音 🎤`,
      { parse_mode: 'HTML' }
    );
  }
}

/**
 * 处理文件请求（通过ID取回）
 */
async function handleFileRequest(bot, chatId, shareId, msg) {
  const fileInfo = fileCache.get(shareId);

  if (!fileInfo) {
    return bot.sendMessage(chatId,
      `❌ 找不到该文件\n\n` +
      `可能的原因：\n` +
      `• ID错误或已过期\n` +
      `• 机器人重启后缓存丢失（文件仍在群组中）\n\n` +
      `<b>💡 解决方法：</b>可从群组转发文件给我`,
      { parse_mode: 'HTML' }
    );
  }

  const catConfig = FILE_CATEGORIES[fileInfo.category] || { emoji: '📁', name: '文件' };

  try {
    await bot.copyMessage(chatId, GROUP_ID, fileInfo.messageId, {
      caption: `${catConfig.emoji} ${fileInfo.fileName}\n💾 ${fileInfo.fileSize}\n🆔 ${shareId}`
    });

    console.log(`[发送成功] ID:${shareId} 给用户:${msg.from.username || msg.from.first_name}`);

  } catch (error) {
    console.error('发送文件失败:', error);
    await bot.sendMessage(chatId, '❌ 文件发送失败，可能已被删除或群组不可访问');
  }
}

/**
 * 处理命令
 */
async function handleCommand(bot, chatId, text, msg) {
  const command = text.split(' ')[0].toLowerCase();

  switch (command) {
    case '/start':
      // 处理启动参数（如 /start Ab3x9K）
      const args = text.split(' ');
      if (args.length > 1 && args[1].length === 6) {
        return handleFileRequest(bot, chatId, args[1], msg);
      }

      await bot.sendMessage(chatId,
        `👋 <b>欢迎使用 TG网盘机器人 v3.0！</b>\n\n` +
        `📤 <b>上传文件</b>\n` +
        `发送视频、图片、文档，选择分类保存\n\n` +
        `📥 <b>获取文件</b>\n` +
        `发送6位分享ID（如：Ab3x9K）\n\n` +
        `📂 <b>浏览网盘</b>\n` +
        `使用 /folder 查看分类文件夹\n\n` +
        `✨ <b>文件分类存储，永久保存！</b>`,
        {
          parse_mode: 'HTML',
          reply_markup: getFolderKeyboard()
        }
      );
      break;

    case '/help':
      await bot.sendMessage(chatId,
        `📖 <b>使用帮助</b>\n\n` +
        `<b>📤 上传文件：</b>\n` +
        `1. 发送文件给机器人\n` +
        `2. 选择分类（视频/图片/文档/音频/语音）\n` +
        `3. 获得分享ID\n\n` +
        `<b>📥 下载文件：</b>\n` +
        `发送分享ID（如：Ab3x9K）\n\n` +
        `<b>📂 浏览网盘：</b>\n` +
        `发送 /folder 打开分类文件夹\n` +
        `发送 /stats 查看存储统计\n\n` +
        `<b>✨ 所有文件永久分类保存！</b>`,
        { parse_mode: 'HTML' }
      );
      break;

    case '/folder':
    case '/folders':
      await bot.sendMessage(chatId,
        `📂 <b>我的网盘</b>\n\n选择文件夹查看文件：`,
        {
          parse_mode: 'HTML',
          reply_markup: getFolderKeyboard()
        }
      );
      break;

    case '/stats':
      const stats = getStats();
      await bot.sendMessage(chatId,
        `📊 <b>网盘统计</b>\n\n` +
        `📁 已存储文件：${stats.totalFiles}\n` +
        `🎬 视频：${stats.videoCount}\n` +
        `🖼 图片：${stats.photoCount}\n` +
        `📄 文档：${stats.documentCount}\n` +
        `🎵 音频：${stats.audioCount}\n` +
        `🎤 语音：${stats.voiceCount}\n\n` +
        `<b>✨ 所有文件分类保存</b>`,
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

  if (data.startsWith('cat_')) {
    // 分类选择
    const category = data.substring(4);
    await handleCategorySelection(bot, chatId, userId, category);
  }
  else if (data.startsWith('folder_')) {
    // 文件夹浏览
    const folder = data.substring(7);
    await handleFolderView(bot, chatId, userId, folder);
  }
  else if (data === 'open_folder') {
    // 打开网盘
    await bot.sendMessage(chatId,
      `📂 <b>我的网盘</b>\n\n选择文件夹：`,
      {
        parse_mode: 'HTML',
        reply_markup: getFolderKeyboard()
      }
    );
  }
  else if (data.startsWith('copy_')) {
    // 复制ID
    const id = data.substring(5);
    await bot.sendMessage(chatId,
      `📋 分享ID：<code>${id}</code>\n\n复制上面这串代码发送给别人`,
      { parse_mode: 'HTML' }
    );
  }

  await bot.answerCallbackQuery(callbackQuery.id);
}

/**
 * 查看文件夹内容
 */
async function handleFolderView(bot, chatId, userId, folder) {
  // 统计该用户的文件
  const userFiles = [];
  for (const [id, info] of fileCache.entries()) {
    if (info.userId === userId && (folder === 'all' || info.category === folder)) {
      userFiles.push({ id, ...info });
    }
  }

  // 全部文件 - 显示概览
  if (folder === 'all') {
    const catCounts = {};
    for (const [id, info] of fileCache.entries()) {
      if (info.userId === userId) {
        catCounts[info.category] = (catCounts[info.category] || 0) + 1;
      }
    }

    let summary = '📂 <b>我的网盘概览</b>\n\n';
    for (const [cat, count] of Object.entries(catCounts)) {
      const catConfig = FILE_CATEGORIES[cat];
      if (catConfig) {
        summary += `${catConfig.emoji} ${catConfig.name}：${count} 个文件\n`;
      }
    }
    summary += `\n📊 总计：${userFiles.length} 个文件`;

    return bot.sendMessage(chatId, summary, {
      parse_mode: 'HTML',
      reply_markup: getFolderKeyboard()
    });
  }

  // 特定文件夹
  const catConfig = FILE_CATEGORIES[folder];
  if (!catConfig) {
    return bot.sendMessage(chatId, '❌ 无效的文件夹');
  }

  if (userFiles.length === 0) {
    return bot.sendMessage(chatId,
      `${catConfig.emoji} <b>${catConfig.name}文件夹</b>\n\n` +
      `这里还没有文件。\n\n` +
      `发送${catConfig.name}给我开始上传！`,
      {
        parse_mode: 'HTML',
        reply_markup: getFolderKeyboard()
      }
    );
  }

  let fileList = `${catConfig.emoji} <b>${catConfig.name}文件夹</b>\n` +
    `共 ${userFiles.length} 个文件\n\n`;

  userFiles.slice(0, 15).forEach((file, index) => {
    fileList += `${index + 1}. ${file.fileName}\n`;
    fileList += `   💾 ${file.fileSize}  🆔 <code>${file.id}</code>\n\n`;
  });

  if (userFiles.length > 15) {
    fileList += `... 还有 ${userFiles.length - 15} 个文件`;
  }

  await bot.sendMessage(chatId, fileList, {
    parse_mode: 'HTML',
    reply_markup: getFolderKeyboard()
  });
}

/**
 * 获取统计信息
 */
function getStats() {
  let videoCount = 0, photoCount = 0, documentCount = 0, audioCount = 0, voiceCount = 0;

  for (const file of fileCache.values()) {
    switch (file.category) {
      case 'video': videoCount++; break;
      case 'photo': photoCount++; break;
      case 'document': documentCount++; break;
      case 'audio': audioCount++; break;
      case 'voice': voiceCount++; break;
    }
  }

  return {
    totalFiles: fileCache.size,
    videoCount,
    photoCount,
    documentCount,
    audioCount,
    voiceCount
  };
}
