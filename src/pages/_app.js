import { useEffect, useRef } from "react";
import "@/styles/globals.css";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/router";
import useAlerts from "@/hooks/useAlerts";
import useListingModerationNotifications from "@/hooks/useListingModerationNotifications";
import useAgentUpgradeNotifications from "@/hooks/useAgentUpgradeNotifications";
import AgentUpgradeWelcomeListener from "@/components/agent/AgentUpgradeWelcomeListener";
import { UserRoleProvider } from "@/hooks/useUserRole";
import { AuthGateProvider } from "@/components/auth/AuthGateProvider";
import useRouteMemory from "@/hooks/useRouteMemory";
import { pageTransition } from "@/lib/motionTokens";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { FavoriteSignupPromptProvider } from "@/components/FavoriteSignupPromptProvider";
import Footer from "@/components/Footer";
import AppErrorBoundary from "@/components/AppErrorBoundary";

function ModerationNotificationListener() {
  useListingModerationNotifications();
  useAgentUpgradeNotifications();
  return (
    <>
      <AgentUpgradeWelcomeListener />
    </>
  );
}

function AppWithAlerts({ Component, pageProps }) {
  const router = useRouter();
  const skipPageEnterRef = useRef(true);
  useAlerts();
  useRouteMemory();

  useEffect(() => {
    skipPageEnterRef.current = false;
  }, []);

  return (
    <ToastProvider>
      <UserRoleProvider>
        <ModerationNotificationListener />
        <AuthGateProvider>
          <FavoriteSignupPromptProvider>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={router.pathname}
              initial={skipPageEnterRef.current ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={pageTransition}
              style={{ minHeight: 0, overflow: "visible" }}
            >
              <AppErrorBoundary>
                <Component {...pageProps} />
              </AppErrorBoundary>
            </motion.div>
          </AnimatePresence>
          <Footer />
          </FavoriteSignupPromptProvider>
        </AuthGateProvider>
      </UserRoleProvider>
    </ToastProvider>
  );
}

export default function App(props) {
  return <AppWithAlerts {...props} />;
}