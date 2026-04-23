import "@/styles/globals.css";
import useAlerts from "@/hooks/useAlerts";
import useAuth from "@/hooks/useAuth";

function AppWithAlerts({ Component, pageProps }) {
  useAlerts();
  useAuth();
  return <Component {...pageProps} />;
}

export default function App(props) {
  return <AppWithAlerts {...props} />;
}