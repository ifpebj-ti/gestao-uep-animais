import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import apiRoutes from "./routes/index.js";
import { notFoundHandler, errorHandler } from "./middlewares/errorHandler.js";

/*
 * Monta a aplicação Express sem abrir porta. O index.js é quem chama
 * listen(); os testes de integração importam este arquivo e sobem a API numa
 * porta livre (listen(0)), sem precisar de um processo separado.
 */
const app = express();

app.disable("x-powered-by");

const corsOrigins = (
  process.env.CORS_ORIGINS || "http://localhost:8080,http://127.0.0.1:5500"
)
  .split(",")
  .map((origem) => origem.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
    // O front lê o nome do arquivo baixado (relatórios/PDFs) deste header.
    exposedHeaders: ["Content-Disposition"],
  })
);

app.use(express.json());

if (process.env.NODE_ENV !== "test") {
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
}

function health(_req, res) {
  res.json({ status: "ok", service: "gestao-uep-backend" });
}

// /health é usado pelo healthcheck do Docker; /api/health é o mesmo check
// atrás do prefixo da API (útil quando o proxy reverso só repassa /api).
app.get("/health", health);
app.get("/api/health", health);

app.use("/api", apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
