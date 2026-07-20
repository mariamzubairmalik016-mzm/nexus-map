import { app } from "./app.js";
import { env } from "./config/env.js";

app.listen(env.PORT, () => {
  console.log(`Nexus Map Backend running at http://localhost:${env.PORT}`);
});
