import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Users, MapPin, AlertTriangle, X } from "lucide-react";

const FAB = () => {
  const [open, setOpen] = useState(false);

  const actions = [
    { id: "team", icon: Users, label: "Нужна бригада", color: "gradient-primary" },
    { id: "nearby", icon: MapPin, label: "Заказы рядом", color: "gradient-primary" },
    { id: "sos", icon: AlertTriangle, label: "SOS", color: "bg-destructive" },
  ];

  return (
    <div className="fab-docked">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-16 right-0 space-y-3 mb-2"
          >
            {actions.map((action, i) => (
              <motion.button
                key={action.id}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 whitespace-nowrap"
              >
                <span className="text-xs font-semibold text-foreground px-3 py-1.5 rounded-lg neu-card">
                  {action.label}
                </span>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  action.id === "sos" ? "bg-destructive" : "gradient-primary"
                }`} style={{
                  boxShadow: action.id === "sos"
                    ? '0 4px 20px hsl(0 72% 51% / 0.4)'
                    : '0 4px 20px hsl(230 60% 58% / 0.35)',
                }}>
                  <action.icon size={20} className="text-white" />
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen(!open)}
        className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center active:scale-90 transition-transform"
        style={{
          boxShadow: '6px 6px 14px hsl(228 22% 6%), -4px -4px 10px hsl(228 18% 20%), 0 4px 20px hsl(230 60% 58% / 0.4)',
        }}
      >
        <motion.div animate={{ rotate: open ? 45 : 0 }}>
          {open ? <X size={24} className="text-primary-foreground" /> : <Plus size={24} className="text-primary-foreground" />}
        </motion.div>
      </button>
    </div>
  );
};

export default FAB;
