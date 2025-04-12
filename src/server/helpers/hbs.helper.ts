import * as hbs from "hbs";

export function registerHandlebarsHelpers() {
  hbs.registerHelper("notEquals", (a, b) => a !== b);

  hbs.registerHelper("isActive", (status) => {
    return status === "ON";
  });

  hbs.registerHelper("formatDate", (timestamp) => new Date(timestamp).toLocaleString());
}
