import { Router } from "express";
import { getSettings } from "../lib/settings.js";

const router = Router();

router.get("/settings", async (_req, res) => {
  try {
    const s = await getSettings();
    res.json({
      welcomeBonus: s.welcomeBonus ?? 100,
      verifyBonus: s.verifyBonus ?? 0,
      announcement: s.announcement ?? "",
      maintenanceMode: !!s.maintenanceMode,
    });
  } catch {
    res.json({ welcomeBonus: 100, verifyBonus: 0, announcement: "", maintenanceMode: false });
  }
});

export default router;
