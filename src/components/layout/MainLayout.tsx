import { ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { motion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const isMobile = useIsMobile();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {isMobile ? (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            className="w-64 bg-sidebar p-0 text-sidebar-foreground border-sidebar-border [&>button]:hidden"
          >
            <Sidebar collapsed={false} variant="inline" />
          </SheetContent>
        </Sheet>
      ) : (
        <Sidebar collapsed={isCollapsed} onToggle={() => setIsCollapsed((prev) => !prev)} />
      )}
      <main
        className={cn(
          "min-h-screen",
          isMobile ? "pl-0" : isCollapsed ? "pl-20" : "pl-64",
        )}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="min-h-screen p-6"
        >
          {isMobile ? (
            <div className="mb-6">
              <Button variant="outline" size="icon" onClick={() => setMobileOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
            </div>
          ) : null}
          {children}
          <NotificationCenter />
        </motion.div>
      </main>
    </div>
  );
}
