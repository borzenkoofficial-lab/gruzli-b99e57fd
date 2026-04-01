export interface Job {
  id: string;
  title: string;
  description: string;
  price: number;
  address: string;
  date: string;
  time: string;
  workersNeeded: number;
  distance: string;
  type: string;
  urgent: boolean;
  photo?: string;
  responses: number;
}

export interface ChatPreview {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
}

export interface Message {
  id: string;
  text?: string;
  image?: string;
  imageProgress?: number;
  voice?: { duration: string };
  time: string;
  own: boolean;
}

export interface Dispatcher {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  online: boolean;
  bio: string;
  activeOrders: number;
}

export const mockJobs: Job[] = [
  {
    id: "1",
    title: "Переезд 2-комнатной квартиры",
    description: "Нужна аккуратная упаковка и перевозка мебели. Есть пианино, стиралка, холодильник.",
    price: 12000,
    address: "ул. Ленина, 45 → ул. Мира, 12",
    date: "15 апреля",
    time: "09:00",
    workersNeeded: 3,
    distance: "2.3 км",
    type: "Переезд",
    urgent: true,
    responses: 5,
  },
  {
    id: "2",
    title: "Разгрузка фуры со стройматериалами",
    description: "Кирпич, цемент, арматура. Около 15 тонн. Нужны крепкие ребята.",
    price: 8500,
    address: "Складская ул., 8",
    date: "16 апреля",
    time: "07:00",
    workersNeeded: 4,
    distance: "5.1 км",
    type: "Погрузка/Разгрузка",
    urgent: false,
    responses: 2,
  },
  {
    id: "3",
    title: "Такелаж сейфа 800 кг",
    description: "Спуск сейфа с 3 этажа без лифта. Нужны стропы и такелажное оборудование.",
    price: 18000,
    address: "пр. Победы, 22",
    date: "17 апреля",
    time: "14:00",
    workersNeeded: 4,
    distance: "1.8 км",
    type: "Такелаж",
    urgent: false,
    responses: 1,
  },
  {
    id: "4",
    title: "Подъём мебели на 9 этаж",
    description: "Новая мебель из магазина: шкаф-купе, диван, кровать. Лифт работает, но шкаф не входит.",
    price: 6000,
    address: "ул. Гагарина, 101",
    date: "15 апреля",
    time: "16:00",
    workersNeeded: 2,
    distance: "3.4 км",
    type: "Межэтаж",
    urgent: true,
    responses: 8,
  },
  {
    id: "5",
    title: "Офисный переезд (15 рабочих мест)",
    description: "Упаковка оргтехники, перевозка столов и стульев. Всё в пределах города.",
    price: 25000,
    address: "БЦ «Альфа» → БЦ «Омега»",
    date: "20 апреля",
    time: "20:00",
    workersNeeded: 6,
    distance: "7.2 км",
    type: "Переезд",
    urgent: false,
    responses: 3,
  },
];

export const mockChats: ChatPreview[] = [
  { id: "1", name: "Алексей Петров", avatar: "АП", lastMessage: "Буду на месте через 20 минут...", time: "2м", unread: 0, online: true },
  { id: "2", name: "Марина Сидорова", avatar: "МС", lastMessage: "Сколько грузчиков нужно?", time: "3ч", unread: 0, online: false },
  { id: "3", name: "Дмитрий Козлов", avatar: "ДК", lastMessage: "Фото объекта прислал", time: "7ч", unread: 0, online: true },
  { id: "4", name: "Виктор Иванов", avatar: "ВИ", lastMessage: "Заказ подтверждён, ждём вас", time: "21ч", unread: 3, online: false },
  { id: "5", name: "Ольга Кузнецова", avatar: "ОК", lastMessage: "Спасибо за работу! Оставлю отзыв", time: "3д", unread: 0, online: false },
  { id: "6", name: "Сергей Волков", avatar: "СВ", lastMessage: "Когда сможете приехать?", time: "7д", unread: 0, online: true },
];

export const mockMessages: Message[] = [
  { id: "1", text: "Добрый день! Видел вашу заявку на переезд. Готов взяться. 👋", time: "12:44", own: false },
  { id: "2", text: "Отлично! Можете посмотреть фото квартиры и оценить объём работы?", time: "12:46", own: false },
  { id: "3", image: "apartment", imageProgress: 70, time: "", own: true },
  { id: "4", voice: { duration: "00:35" }, time: "08:26", own: true },
  { id: "5", text: "Хорошо, приеду осмотреть завтра в 10:00. Устроит?", time: "08:30", own: true },
];

export const mockDispatchers: Dispatcher[] = [
  { id: "1", name: "Николай Фёдоров", avatar: "НФ", rating: 4.9, online: true, bio: "Опыт 7 лет. Переезды, такелаж, офисы.", activeOrders: 12 },
  { id: "2", name: "Елена Макарова", avatar: "ЕМ", rating: 4.8, online: true, bio: "Специализация: коммерческие переезды", activeOrders: 8 },
  { id: "3", name: "Руслан Ахметов", avatar: "РА", rating: 4.7, online: false, bio: "Такелаж, промышленное оборудование", activeOrders: 5 },
  { id: "4", name: "Анна Белова", avatar: "АБ", rating: 4.9, online: true, bio: "Быстрый подбор бригад. Гарантия качества.", activeOrders: 15 },
  { id: "5", name: "Тимур Касимов", avatar: "ТК", rating: 4.6, online: false, bio: "Межгород, международные перевозки", activeOrders: 3 },
];
