import * as hbs from "hbs";

export function registerHandlebarsHelpers() {
  hbs.registerHelper("notEquals", (a, b) => a !== b);

  hbs.registerHelper("isExpiring", (expireAt) => {
    const now = Date.now();
    return expireAt - now < 30000; // Less than 30 seconds
  });

  hbs.registerHelper("formatDate", (timestamp) => new Date(timestamp).toLocaleString());
}
