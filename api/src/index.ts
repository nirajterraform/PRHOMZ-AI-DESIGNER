import * as admin from "firebase-admin";
import apiApp from "./apiApp";
import webhookApp from "./webhookApp";

admin.initializeApp();

const processType = (process.env.PROCESS_TYPE ?? "api").toLowerCase();
const PORT = parseInt(process.env.PORT ?? "8080", 10);

const app = processType === "webhook" ? webhookApp : apiApp;
const serviceName = processType === "webhook" ? "prhomz-stripe-webhook" : "prhomz-api";

app.listen(PORT, () => {
  console.log(
    JSON.stringify({
      severity: "INFO",
      message: `${serviceName} listening on :${PORT}`,
      processType,
    }),
  );
});
