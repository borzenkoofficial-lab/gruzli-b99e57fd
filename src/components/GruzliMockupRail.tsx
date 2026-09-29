import { BriefcaseBusiness, MessageCircle, Search, Star, Users, MapPin } from "lucide-react";

type MockupRailProps = {
  role?: string | null;
};

const Phone = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="relative w-[154px] shrink-0">
    <div className="rounded-[26px] border-[5px] border-foreground/90 bg-foreground p-[3px] shadow-[0_18px_40px_rgba(15,16,18,.22)]">
      <div className="relative h-[270px] overflow-hidden rounded-[19px] bg-background">
        <div className="absolute left-1/2 top-1.5 z-10 h-4 w-14 -translate-x-1/2 rounded-full bg-foreground" />
        <div className="px-3 pt-7 pb-3">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[8px] font-extrabold tracking-[.12em] text-muted-foreground">GRUZLI</span>
            <span className="h-5 w-5 rounded-full bg-primary/20" />
          </div>
          <div className="mb-2 text-[11px] font-extrabold leading-tight text-foreground">{title}</div>
          {children}
        </div>
        <div className="absolute bottom-0 left-0 right-0 flex h-8 items-center justify-around border-t border-border/60 bg-background/90 backdrop-blur">
          <BriefcaseBusiness size={10} className="text-primary" />
          <MessageCircle size={10} className="text-muted-foreground" />
          <Search size={10} className="text-muted-foreground" />
          <Users size={10} className="text-muted-foreground" />
        </div>
      </div>
    </div>
  </div>
);

const MockupRail = ({ role }: MockupRailProps) => {
  const isClient = role === "client";
  const isDispatcher = role === "dispatcher";

  return (
    <section
      className="px-5 pb-5"
      aria-label="Обзор возможностей Gruzli"
    >
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[9px] font-extrabold tracking-[.16em] text-muted-foreground">GRUZLI / APP</p>
          <h2 className="mt-1 text-[18px] font-extrabold tracking-[-.03em] text-foreground">
            Всё в одном приложении
          </h2>
        </div>
        <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[9px] font-bold text-muted-foreground">
          {isClient ? "ЗАКАЗЫ" : isDispatcher ? "РАБОТА" : "РАБОТА"}
        </span>
      </div>

      <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-3 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="snap-start">
          <Phone title={isClient ? "Создать заказ" : "Лента заказов"}>
            <div className="rounded-xl border border-border bg-card p-2.5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[7px] font-bold text-muted-foreground">СЕГОДНЯ</span>
                <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[6px] font-bold text-primary">LIVE</span>
              </div>
              <p className="text-[10px] font-bold text-foreground">{isClient ? "Переезд квартиры" : "Разгрузка фуры"}</p>
              <div className="mt-2 flex items-center gap-1 text-[7px] text-muted-foreground">
                <MapPin size={8} /> Москва · Сокольники
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                <span className="text-[9px] font-extrabold text-foreground">900 ₽/ч</span>
                <span className="rounded-md bg-foreground px-2 py-1 text-[7px] font-bold text-background">Отклик</span>
              </div>
            </div>
            <div className="mt-2 h-11 rounded-xl bg-muted/60 p-2">
              <div className="h-1.5 w-2/3 rounded bg-foreground/10" />
              <div className="mt-1.5 h-1.5 w-1/2 rounded bg-foreground/10" />
            </div>
          </Phone>
        </div>

        <div className="snap-start">
          <Phone title="Чаты">
            <div className="space-y-1.5">
              {["Алексей · заказ", "Мария · диспетчер", "Gruzli Official"].map((name, i) => (
                <div key={name} className="flex items-center gap-2 rounded-xl border border-border bg-card p-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-foreground text-[7px] font-bold text-background">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[8px] font-bold text-foreground">{name}</p>
                    <p className="truncate text-[7px] text-muted-foreground">{i === 0 ? "Буду на месте к 10:00" : "Сообщение..."}</p>
                  </div>
                  {i === 0 && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                </div>
              ))}
            </div>
          </Phone>
        </div>

        <div className="snap-start">
          <Phone title="Картотека">
            <div className="space-y-2">
              {["Алексей Смирнов", "Илья Петров", "Мария Орлова"].map((name, i) => (
                <div key={name} className="flex items-center gap-2 rounded-xl border border-border bg-card p-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-[8px] font-extrabold text-foreground">
                    {name.slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[8px] font-bold text-foreground">{name}</p>
                    <div className="mt-0.5 flex items-center gap-1 text-[7px] text-muted-foreground">
                      <Star size={7} className="fill-current text-primary" /> 4.{8 - i}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Phone>
        </div>
      </div>
    </section>
  );
};

export default MockupRail;
