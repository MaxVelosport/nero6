// Object Storage routes — disabled after Replit→VPS migration.
// Files are now served directly by nginx from /home/deploy/data/uploads/.
// These stubs prevent 404s on any legacy calls.
import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

router.post("/storage/uploads/request-url", (_req: Request, res: Response) => {
  res.status(501).json({ error: "not_implemented", message: "Direct upload not supported on this deployment. Use the AI generation endpoints." });
});

router.get("/storage/public-objects/*filePath", (_req: Request, res: Response) => {
  res.status(410).json({ error: "gone", message: "Public object storage is no longer available." });
});

router.get("/storage/objects/*path", (_req: Request, res: Response) => {
  res.status(410).json({ error: "gone", message: "Object storage is no longer available. Images are served from /uploads/." });
});

export default router;
