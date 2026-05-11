import "@/styles/globals.css";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/router";
import useAlerts from "@/hooks/useAlerts";
import useAuth from "@/hooks/useAuth";
import useRouteMemory from "@/hooks/useRouteMemory";
import { pageTransition } from "@/lib/motionTokens";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { FavoriteSignupPromptProvider } from "@/components/FavoriteSignupPromptProvider";
import Footer from "@/components/Footer";
import AppErrorBoundary from "@/components/AppErrorBoundary";

function AppWithAlerts({ Component, pageProps }) {
  const router = useRouter();
  useAlerts();
  useAuth();
  useRouteMemory();
  return (
    <ToastProvider>
      <FavoriteSignupPromptProvider>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={router.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={pageTransition}
          >
            <AppErrorBoundary>
              <Component {...pageProps} />
            </AppErrorBoundary>
          </motion.div>
        </AnimatePresence>
        <Footer />
      </FavoriteSignupPromptProvider>
    </ToastProvider>
  );
}

export default function App(props) {
  return <AppWithAlerts {...props} />;
}