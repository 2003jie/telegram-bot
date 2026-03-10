// 设置 Telegram Webhook
const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const VERCEL_URL = process.env.VERCEL_URL;

module.exports = async (req, res) => {
  try {
    if (!TOKEN) {
      return res.status(400).json({ 
        error: 'Missing TELEGRAM_BOT_TOKEN',
        message: '请在 Vercel 环境变量中设置 TELEGRAM_BOT_TOKEN' 
      });
    }

    const bot = new TelegramBot(TOKEN);
    
    // 构建 webhook URL
    const webhookUrl = VERCEL_URL 
      ? `https://${VERCEL_URL}/api/webhook`
      : '请在部署后访问此接口';
    
    if (req.method === 'GET') {
      // 获取当前 webhook 信息
      const webhookInfo = await bot.getWebHookInfo();
      
      return res.status(200).json({
        status: 'info',
        current_webhook: webhookInfo,
        expected_webhook: webhookUrl,
        setup_url: webhookUrl !== '请在部署后访问此接口' 
          ? `/api/set-webhook?action=set` 
          : null
      });
    }
    
    if (req.method === 'POST' || req.query.action === 'set') {
      if (webhookUrl === '请在部署后访问此接口') {
        return res.status(400).json({
          error: 'VERCEL_URL not available',
          message: '请先部署到 Vercel，然后访问此接口'
        });
      }
      
      // 设置 webhook
      await bot.setWebHook(webhookUrl);
      
      return res.status(200).json({
        status: 'success',
        message: 'Webhook 设置成功',
        webhook_url: webhookUrl
      });
    }
    
    res.status(200).json({
      status: 'ok',
      message: '使用 GET 查看信息，POST 或 ?action=set 设置 webhook'
    });
    
  } catch (error) {
    console.error('设置 webhook 失败:', error);
    res.status(500).json({ 
      error: error.message,
      tip: '请检查 TELEGRAM_BOT_TOKEN 是否正确'
    });
  }
};
