import "@/styles/globals.css";
import useAlerts from "@/hooks/useAlerts";
import useAuth from "@/hooks/useAuth";
import { ToastProvider } from "@/components/ui/ToastProvider";

function AppWithAlerts({ Component, pageProps }) {
  useAlerts();
  useAuth();
  return (
    <ToastProvider>
      <Component {...pageProps} />
    </ToastProvider>
  );
}

export default function App(props) {
  return <AppWithAlerts {...props} />;
}