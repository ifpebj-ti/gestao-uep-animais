import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import apiRoutes from "./routes/index.js"; // <- Aqui ele importa aquele seu arquivo de rotas!
import { notFoundHandler, errorHandler } from "./middlewares/errorHandler.js";

const app = express();
const PORT = process.env.BACKEND_PORT || 3000;

// Ajuste do CORS para o seu frontend
app.use(
  cors({
    origin: ["http://127.0.0.1:5500", "http://localhost:8080"], // Coloque a porta do seu HTML
    credentials: true,
  })
);

app.use(express.json());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "gestao-uep-backend" });
});

// Usando as rotas que você me mandou
app.use("/api", apiRoutes); 

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Backend rodando na porta ${PORT}`);
});