import React from "react";
import ReactDOM from "react-dom/client";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { MantineProvider, localStorageColorSchemeManager } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/charts/styles.css";
import "mantine-datatable/styles.css";
import "./index.css";
import App from "./App";
import { isAuthRequiredError } from "./api";
import { noteAuthFailure } from "./lib/session";
import "./i18n";

const queryClient = new QueryClient({
  // Any request the proxy turns away reloads the page, wherever in the UI it
  // happened, so the proxy can send the user to its login page.
  queryCache: new QueryCache({ onError: noteAuthFailure }),
  mutationCache: new MutationCache({ onError: noteAuthFailure }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // Retrying a login redirect changes nothing until the user signs in.
      retry: (failureCount, error) =>
        !isAuthRequiredError(error) && failureCount < 3,
    },
  },
});

// Persist the user's light/dark/auto choice across reloads under a
// stable key so the first paint already uses the right scheme.
const colorSchemeManager = localStorageColorSchemeManager({
  key: "color-scheme",
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider
      defaultColorScheme="auto"
      colorSchemeManager={colorSchemeManager}
    >
      <Notifications position="top-right" />
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </MantineProvider>
  </React.StrictMode>,
);
