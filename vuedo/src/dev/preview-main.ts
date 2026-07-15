import { createApp } from "vue";
import Invoice from "../templates/Invoice.vue";
import fixture from "./fixtures/invoice.sample.json";

createApp(Invoice, fixture).mount("#app");
