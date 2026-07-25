import AppRoutes from "./routes/AppRoutes";
import ConnectionStatus from "./components/offline/ConnectionStatus";
import ErrorBoundary from "./components/ui/ErrorBoundary";

// The outer boundary is the last line of defence: without it any render error
// unmounts the whole tree and the user sees a blank page. ConnectionStatus sits
// outside it so the offline indicator survives a crash in the routed content.
const App = () => (
  <>
    <ErrorBoundary>
      <AppRoutes />
    </ErrorBoundary>
    <ConnectionStatus />
  </>
);
export default App;
