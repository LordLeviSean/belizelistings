import "@/styles/globals.css";
import useAlerts from "@/hooks/useAlerts";
import useAuth from "@/hooks/useAuth";
import { ToastProvider } from "@/components/ui/ToastProvider";
import Footer from "@/components/Footer";

function AppWithAlerts({ Component, pageProps }) {
  useAlerts();
  useAuth();
  return (
    <ToastProvider>
      <Component {...pageProps} />
      <Footer />
    </ToastProvider>
  );
}

export default function App(props) {
  return <AppWithAlerts {...props} />;
}