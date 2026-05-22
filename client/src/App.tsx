import { Switch, Route, Router } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "./components/ThemeProvider";
import Home from "./pages/Home";
import RateMovie from "./pages/RateMovie";
import History from "./pages/History";
import Stats from "./pages/Stats";
import NotFound from "./pages/not-found";
import { useCallback, useState, useEffect } from "react";

// Custom hash location hook that strips query string from path
function useCleanHashLocation(): [string, (to: string) => void] {
  const getPath = () => {
    const hash = window.location.hash.replace(/^#/, "") || "/";
    return hash.split("?")[0] || "/";
  };

  const [loc, setLoc] = useState(getPath);

  useEffect(() => {
    const onHashChange = () => setLoc(getPath());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = useCallback((to: string) => {
    window.location.hash = to;
  }, []);

  return [loc, navigate];
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Router hook={useCleanHashLocation}>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/rate" component={RateMovie} />
            <Route path="/rate/:id" component={RateMovie} />
            <Route path="/history" component={History} />
            <Route path="/stats" component={Stats} />
            <Route component={NotFound} />
          </Switch>
        </Router>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
