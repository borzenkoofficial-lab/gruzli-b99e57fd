export interface Job {
  id: string;
  title: string;
  description: string;
  price: number;
  netPay: number;
  address: string;
  date: string;
  time: string;
  workersNeeded: number;
  distance: string;
  type: string;
  urgent: boolean;
  photo?: string;
  responses: number;
  noElevator?: boolean;
  pairWork?: boolean;
  deadlineMinutes?: number;
}

export interface ChatPreview {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
  isGroup?: boolean;
  members?: number;
}

export interface Message {
  id: string;
  text?: string;
  image?: string;
  imageProgress?: number;
  voice?: { duration: string };
  time: string;
  own: boolean;
  sender?: string;
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

export interface OrderItem {
  id: string;
  title: string;
  price: number;
  date: string;
  time: string;
  status: string;
  progress: number;
  address: string;
  deadlineMinutes?: number;
  checklistDone?: boolean;
}

export const mockJobs: Job[] = [
  {
    id: "1",
    title: "Переезд 2-комнатной квартиры",
    description: "Нужна аккуратная упаковка и перевозка мебели. Есть пианино, стиралка, холодильник.",
    price: 12000,
    netPay: 9600,
    address: "ул. Ленина, 45 → ул. Мира, 12",
    date: "15 апреля",
    time: "09:00",
    workersNeeded: 3,
    distance: "2.3 км",
    type: "Переезд",
    urgent: true,
    responses: 5,
    deadlineMinutes: 45,
  },
  {
    id: "2",
    title: "Разгрузка фуры со стройматериалами",
    description: "Кирпич, цемент, арматура. Около 15 тонн. Нужны крепкие ребята.",
    price: 8500,
    netPay: 6800,
    address: "Складская ул., 8",
    date: "16 апреля",
    time: "07:00",
    workersNeeded: 4,
    distance: "5.1 км",
    type: "Погрузка/Разгрузка",
    urgent: false,
    responses: 2,
    pairWork: true,
  },
  {
    id: "3",
    title: "Такелаж сейфа 800 кг",
    description: "Спуск сейфа с 3 этажа без лифта. Нужны стропы и такелажное оборудование.",
    price: 18000,
    netPay: 14400,
    address: "пр. Победы, 22",
    date: "17 апреля",
    time: "14:00",
    workersNeeded: 4,
    distance: "1.8 км",
    type: "Такелаж",
    urgent: false,
    responses: 1,
    noElevator: true,
  },
  {
    id: "4",
    title: "Подъём мебели на 9 этаж",
    description: "Новая мебель из магазина: шкаф-купе, диван, кровать. Лифт работает, но шкаф не входит.",
    price: 6000,
    netPay: 4800,
    address: "ул. Гагарина, 101",
    date: "15 апреля",
    time: "16:00",
    workersNeeded: 2,
    distance: "3.4 км",
    type: "Межэтаж",
    urgent: true,
    responses: 8,
    noElevator: true,
    deadlineMinutes: 20,
  },
  {
    id: "5",
    title: "Офисный переезд (15 рабочих мест)",
    description: "Упаковка оргтехники, перевозка столов и стульев. Всё в пределах города.",
    price: 25000,
    netPay: 20000,
    address: "БЦ «Альфа» → БЦ «Омега»",
    date: "20 апреля",
    time: "20:00",
    workersNeeded: 6,
    distance: "7.2 км",
    type: "Переезд",
    urgent: false,
    responses: 3,
    pairWork: true,
  },
  {
    id: "6",
    title: "Погрузка контейнера",
    description: "20-футовый контейнер, коробки по 15-30 кг. Нужна скорость.",
    price: 7000,
    netPay: 5600,
    address: "Промзона, д. 3",
    date: "15 апреля",
    time: "12:00",
    workersNeeded: 3,
    distance: "4.0 км",
    type: "Погрузка/Разгрузка",
    urgent: true,
    responses: 0,
    deadlineMinutes: 60,
  },
  {
    id: "7",
    title: "Сборка и подъём кухни IKEA",
    description: "Кухонный гарнитур, доставлен к подъезду. Подъём на 5 этаж без лифта + сборка.",
    price: 9500,
    netPay: 7600,
    address: "ул. Чехова, 88",
    date: "18 апреля",
    time: "10:00",
    workersNeeded: 2,
    distance: "1.2 км",
    type: "Межэтаж",
    urgent: false,
    responses: 4,
    noElevator: true,
    pairWork: true,
  },
];

export const mockChats: ChatPreview[] = [
  { id: "1", name: "Алексей Петров", avatar: "АП", lastMessage: "Буду на месте через 20 минут...", time: "2м", unread: 0, online: true },
  { id: "2", name: "Бригада — Переезд Ленина 45", avatar: "👥", lastMessage: "Кто берёт стиралку?", time: "5м", unread: 4, online: true, isGroup: true, members: 4 },
  { id: "3", name: "Марина Сидорова", avatar: "МС", lastMessage: "Сколько грузчиков нужно?", time: "3ч", unread: 0, online: false },
  { id: "4", name: "Дмитрий Козлов", avatar: "ДК", lastMessage: "Фото объекта прислал", time: "7ч", unread: 0, online: true },
  { id: "5", name: "Бригада — Такелаж сейфа", avatar: "👥", lastMessage: "Стропы взяли?", time: "12ч", unread: 1, online: true, isGroup: true, members: 5 },
  { id: "6", name: "Виктор Иванов", avatar: "ВИ", lastMessage: "Заказ подтверждён, ждём вас", time: "21ч", unread: 3, online: false },
  { id: "7", name: "Ольга Кузнецова", avatar: "ОК", lastMessage: "Спасибо за работу! Оставлю отзыв", time: "3д", unread: 0, online: false },
  { id: "8", name: "Сергей Волков", avatar: "СВ", lastMessage: "Когда сможете приехать?", time: "7д", unread: 0, online: true },
];

export const mockMessages: Message[] = [
  { id: "1", text: "Добрый день! Видел вашу заявку на переезд. Готов взяться. 👋", time: "12:44", own: false, sender: "Алексей" },
  { id: "2", text: "Отлично! Можете посмотреть фото квартиры и оценить объём работы?", time: "12:46", own: false, sender: "Алексей" },
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

export const mockTodayOrders: OrderItem[] = [
  { id: "1", title: "Переезд 2-комнатной квартиры", price: 12000, date: "15 апр", time: "09:00", status: "В пути", progress: 40, address: "ул. Ленина, 45", deadlineMinutes: 45 },
  { id: "2", title: "Подъём мебели на 9 этаж", price: 6000, date: "15 апр", time: "16:00", status: "Ожидание", progress: 10, address: "ул. Гагарина, 101" },
];

export const mockWeekOrders: OrderItem[] = [
  { id: "3", title: "Разгрузка фуры", price: 8500, date: "16 апр", time: "07:00", status: "Подтверждён", progress: 0, address: "Складская ул., 8" },
  { id: "6", title: "Такелаж сейфа 800 кг", price: 18000, date: "17 апр", time: "14:00", status: "Подтверждён", progress: 0, address: "пр. Победы, 22" },
  { id: "7", title: "Сборка кухни IKEA", price: 9500, date: "18 апр", time: "10:00", status: "Ждёт ответа", progress: 0, address: "ул. Чехова, 88" },
];

export const mockDoneOrders: OrderItem[] = [
  { id: "4", title: "Офисный переезд", price: 25000, date: "10 апр", time: "20:00", status: "Завершён", progress: 100, address: "БЦ «Альфа»" },
  { id: "5", title: "Такелаж станка", price: 15000, date: "8 апр", time: "11:00", status: "Завершён", progress: 100, address: "Завод «Прогресс»" },
];

export const leaderboard = [
  { name: "Иван С.", score: 234, avatar: "ИС" },
  { name: "Дмитрий К.", score: 198, avatar: "ДК" },
  { name: "Алексей П.", score: 176, avatar: "АП" },
  { name: "Сергей В.", score: 152, avatar: "СВ" },
  { name: "Руслан А.", score: 143, avatar: "РА" },
];
