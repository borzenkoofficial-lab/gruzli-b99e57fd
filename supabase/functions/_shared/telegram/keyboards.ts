// Reply / inline keyboard builders для бота Грузли

export const WEB_APP_URL = 'https://gruzli.lovable.app/';

export const MENU_LABELS = {
  // worker
  workerJobs: '📋 Доступные заявки',
  workerMyJobs: '🛠 Мои работы',
  workerBalance: '💰 Баланс',
  workerRating: '⭐️ Рейтинг',
  // dispatcher
  dispatcherCreate: '➕ Создать заявку',
  dispatcherJobs: '📂 Мои заявки',
  dispatcherStats: '📊 Статистика',
  dispatcherBroadcast: '📣 Рассылка',
  // common
  settings: '⚙️ Настройки',
  support: '🆘 Поддержка',
  link: '🔗 Привязать аккаунт',
  app: '🚀 Открыть приложение',
  cancel: '❌ Отмена',
  back: '⬅️ Назад',
};

export type Role = 'worker' | 'dispatcher' | 'admin' | null;

export function mainMenu(role: Role) {
  if (role === 'worker') {
    return {
      reply_markup: {
        keyboard: [
          [{ text: MENU_LABELS.workerJobs }, { text: MENU_LABELS.workerMyJobs }],
          [{ text: MENU_LABELS.workerBalance }, { text: MENU_LABELS.workerRating }],
          [{ text: MENU_LABELS.settings }, { text: MENU_LABELS.support }],
        ],
        resize_keyboard: true,
        is_persistent: true,
      },
    };
  }
  if (role === 'dispatcher' || role === 'admin') {
    return {
      reply_markup: {
        keyboard: [
          [{ text: MENU_LABELS.dispatcherCreate }, { text: MENU_LABELS.dispatcherJobs }],
          [{ text: MENU_LABELS.dispatcherStats }, { text: MENU_LABELS.dispatcherBroadcast }],
          [{ text: MENU_LABELS.settings }, { text: MENU_LABELS.support }],
        ],
        resize_keyboard: true,
        is_persistent: true,
      },
    };
  }
  // not linked
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: MENU_LABELS.link, callback_data: 'auth:howto' }],
        [{ text: MENU_LABELS.app, web_app: { url: WEB_APP_URL } }],
      ],
    },
  };
}

export function inlineRow(...buttons: { text: string; callback_data?: string; url?: string }[]) {
  return { reply_markup: { inline_keyboard: [buttons] } };
}

export function inline(rows: { text: string; callback_data?: string; url?: string }[][]) {
  return { reply_markup: { inline_keyboard: rows } };
}

export function cancelKb() {
  return {
    reply_markup: {
      keyboard: [[{ text: MENU_LABELS.cancel }]],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };
}
