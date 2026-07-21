import AppRoutes from "./routes/AppRoutes";
import ConnectionStatus from "./components/offline/ConnectionStatus";
const App = () => (
  <>
    <AppRoutes />
    <ConnectionStatus />
  </>
);
export default App;
