import dayjs from 'dayjs';
import { Telegraf } from 'telegraf';
import { HealthCheck } from './healthcheck.js';
import { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } from '../config/env.js';

const PROJECT_NAME = 'Fanvia';

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

export async function notifyOwner(message, isSuccess = false, retries = 0) {
  const timestamp = dayjs().format(' D-MMMM-YYYY hh:mm A');

  const status = isSuccess ? 'Success' : 'Failure';

  const fullMessage = `
*Project: ${PROJECT_NAME}*

 - *Status:* \`${status}\`
 - *Time:* \`${timestamp}\`
 - *Retries:* \`${retries > 0 ? retries : '1st try'}\`

 >  *Message:* _${message}_

*Note:* ${isSuccess 
    ? '_Data fetched and saved successfully._' 
    : '_Please check and restart the service._'}
`.trim();
  try {
    await bot.telegram.sendMessage(TELEGRAM_CHAT_ID, fullMessage, {
      parse_mode: 'Markdown',
    });
  } catch (err) {
    console.error('Failed to notify owner via Telegraf:', err);
  }
}

// Healthcheck command
bot.command('healthcheck', async (ctx) => {
  try {
    if (ctx.chat.id.toString() === TELEGRAM_CHAT_ID.toString()) {
      const report = await HealthCheck();
      await ctx.replyWithMarkdown(report);
    } else {
      return await ctx.reply('Who are you? mmm don\'t tell. I don\' care');
    }
    
    
  } catch (error) {
    console.error('Healthcheck failed:', error);
    await ctx.reply('Failed to generate a report.');
  }
});

export function startNotiva() {
  bot.launch();
  console.log('Telegram Healthcheck bot is running...');
}
