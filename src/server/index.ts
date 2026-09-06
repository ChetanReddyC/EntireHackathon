import "dotenv/config";

import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const app = createApp(config);

app.listen(config.port, config.host, () => {
  console.log(`Checkpoint Lens running at http://${config.host}:${config.port}`);
});
