import express from "express";

const app = express();
const PORT = process.env.BACKEND_PORT || 3000;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "gestao-uep-backend" });
});

app.listen(PORT, () => {
  console.log(`Backend rodando na porta ${PORT}`);
});
