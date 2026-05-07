import "@/styles/globals.css";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/router";
import useAlerts from "@/hooks/useAlerts";
import useAuth from "@/hooks/useAuth";
import useRouteMemory from "@/hooks/useRouteMemory";
import { ToastProvider } from "@/components/ui/ToastProvider";
import Footer from "@/components/Footer";

function AppWithAlerts({ Component, pageProps }) {
  const router = useRouter();
  useAlerts();
  useAuth();
  useRouteMemory();
  return (
    <ToastProvider>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={router.pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          <Component {...pageProps} />
        </motion.div>
      </AnimatePresence>
      <Footer />
    </ToastProvider>
  );
}

export default function App(props) {
  return <AppWithAlerts {...props} />;
}