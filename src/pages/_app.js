import { useEffect, useRef } from "react";
import "@/styles/globals.css";
import "@/styles/CrmMessagingTokens.css";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/router";
import { PageTitleProvider } from "@/components/PageTitleProvider";
import { resolveRouteTitle, resolveRouteDescription } from "@/lib/siteMetadata";
import useAlerts from "@/hooks/useAlerts";
import useListingModerationNotifications from "@/hooks/useListingModerationNotifications";
import useAgentUpgradeNotifications from "@/hooks/useAgentUpgradeNotifications";
import AgentUpgradeWelcomeListener from "@/components/agent/AgentUpgradeWelcomeListener";
import { UserRoleProvider } from "@/hooks/useUserRole";
import { AuthGateProvider } from "@/components/auth/AuthGateProvider";
import { ListingEngagementAuthPromptProvider } from "@/components/auth/ListingEngagementAuthPromptProvider";
import useRouteMemory from "@/hooks/useRouteMemory";
import { pageTransition } from "@/lib/motionTokens";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { FavoriteSignupPromptProvider } from "@/components/FavoriteSignupPromptProvider";
import Footer from "@/components/Footer";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import { VisualModeProvider } from "@/components/VisualModeProvider";
import GlobalSeaFlowLayer from "@/components/GlobalSeaFlowLayer";
import { fetchPublicVisualModeConfigServerSide } from "@/lib/visualModeConfigServer";
import { registerBelizeListingsServiceWorker } from "@/lib/pwa/registerServiceWorker";
import { handlePushNavigateMessage } from "@/lib/pwa/pushNotificationNavigation";
import { InstallationStateProvider } from "@/lib/pwa/InstallationStateProvider";

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
  const pageTitle =
    pageProps.pageTitle ?? resolveRouteTitle(router.pathname, router.query);
  const pageDescription =
    pageProps.pageDescription ?? resolveRouteDescription(router.pathname);
  useAlerts();
  useRouteMemory();

  useEffect(() => {
    skipPageEnterRef.current = false;
  }, []);

  useEffect(() => {
    registerBelizeListingsServiceWorker();
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.serviceWorker?.addEventListener) return undefined;

    const onServiceWorkerMessage = (event) => {
      handlePushNavigateMessage(event.data, router);
    };

    navigator.serviceWorker.addEventListener("message", onServiceWorkerMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onServiceWorkerMessage);
    };
  }, [router]);

  return (
    <InstallationStateProvider>
    <VisualModeProvider initialConfig={pageProps.visualModeConfig}>
      <GlobalSeaFlowLayer />
      <ToastProvider>
        <PageTitleProvider routeTitle={pageTitle} routeDescription={pageDescription}>
          <UserRoleProvider>
            <ModerationNotificationListener />
            <AuthGateProvider>
              <ListingEngagementAuthPromptProvider>
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
              </ListingEngagementAuthPromptProvider>
            </AuthGateProvider>
          </UserRoleProvider>
        </PageTitleProvider>
      </ToastProvider>
    </VisualModeProvider>
    </InstallationStateProvider>
  );
}

export default function App(props) {
  return <AppWithAlerts {...props} />;
}

App.getInitialProps = async (appContext) => {
  let pageProps = {};
  if (appContext.Component.getInitialProps) {
    pageProps = await appContext.Component.getInitialProps(appContext.ctx);
  }

  let visualModeConfig = null;
  if (appContext.ctx.req) {
    visualModeConfig = await fetchPublicVisualModeConfigServerSide();
  }

  return {
    pageProps: {
      ...pageProps,
      visualModeConfig,
    },
  };
};
