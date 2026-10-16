// Startup file for cPanel "Setup Node.js App" (Passenger). Run `npm run build` first.
const { createServer } = require("http");
const next = require("next");

const app = next({ dev: false });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(process.env.PORT || 3000, () => {
    console.log("Nargito ready");
  });
});
