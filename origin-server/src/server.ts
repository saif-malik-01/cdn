import express from "express";
import path from "path";

const app = express();
const PORT = 3001;

const __ROOT = process.cwd();

app.get("/html", async (_, res) => {
  console.log(">>>>>>> HTML");
  await new Promise((resolve) => setTimeout(resolve, 3000));
  res.setHeader(
    "Cache-Control",
    "public, max-age=6, stale-while-revalidate=10"
  );
  res.sendFile(path.join(__ROOT, "public", "index.html"));
});

app.get("/image", async (_, res) => {
  console.log(">>>>>>> IMAGE");
  await new Promise((resolve) => setTimeout(resolve, 3000));
   res.setHeader(
    "Cache-Control",
    "public, max-age=10, stale-while-revalidate=10"
  );
  res.sendFile(path.join(__ROOT, "public", "image.jpg"));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
