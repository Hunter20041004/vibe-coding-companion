import { createCompanionClassifierFromEnv } from "./ai-companion-classifier.js";
import { writeGoogleAiStudioEnv } from "./companion-launcher.js";
import {
  readOverlaySettings,
  writeOverlaySettings,
} from "./overlay-settings.js";
import { detectMacForegroundApp } from "./overlay-main-runtime.js";
import { createPlacementDiagnostic } from "./placement-diagnostic.js";
import { createInstalledSkillLoader } from "./installed-skill-index.js";
import { createReadinessDiagnostic } from "./readiness-diagnostic.js";
import { createVisionAnalyzerFromEnv } from "./vision-context.js";

export function createEventServerOptions({
  cwd = process.cwd(),
  processEnv = process.env,
  writeGoogleAiStudioEnv: writeEnv = writeGoogleAiStudioEnv,
  createClassifierFromEnv = createCompanionClassifierFromEnv,
  createVisionAnalyzerFromEnv: createVisionAnalyzer = createVisionAnalyzerFromEnv,
  createPlacementDiagnostic: createDiagnostic = createPlacementDiagnostic,
  createReadinessDiagnostic: createReadiness = createReadinessDiagnostic,
  detectForeground = detectMacForegroundApp,
  readOverlaySettings: readOverlay = readOverlaySettings,
  writeOverlaySettings: writeOverlay = writeOverlaySettings,
  loadInstalledSkills = createInstalledSkillLoader(),
} = {}) {
  const getOverlaySettings = () => readOverlay();
  const getPlacementDiagnostic = createDiagnostic({
    detectForeground,
    getOverlaySettings,
  });
  const getReadinessDiagnostic = createReadiness({
    cwd,
    detectForeground,
  });

  return {
    getOverlaySettings,
    saveOverlaySettings: (settings) => writeOverlay({ settings }),
    getPlacementDiagnostic,
    getReadinessDiagnostic,
    loadInstalledSkills,
    getSettingsStatus: () => ({
      aiConfigured: Boolean(
        processEnv.AI_API_KEY ??
          processEnv.GEMINI_API_KEY ??
          processEnv.GOOGLE_API_KEY ??
          processEnv.OPENAI_API_KEY
      ),
      provider:
        processEnv.AI_PROVIDER ??
        (processEnv.GEMINI_API_KEY || processEnv.GOOGLE_API_KEY
          ? "google"
          : processEnv.OPENAI_API_KEY
            ? "openai"
            : null),
      model:
        processEnv.AI_MODEL ??
        processEnv.GEMINI_MODEL ??
        processEnv.OPENAI_MODEL ??
        null,
    }),
    saveGoogleAiStudioKey: async ({ apiKey, model }) => {
      await writeEnv({ apiKey, model });
      processEnv.AI_PROVIDER = "google";
      processEnv.GEMINI_API_KEY = apiKey;
      processEnv.AI_MODEL = model;
    },
    classifyEvent: async (input) => {
      const classifier = createClassifierFromEnv(processEnv);
      if (!classifier) return null;
      return classifier(input);
    },
    analyzeVisionContext: async (input) => {
      const analyzer = createVisionAnalyzer(processEnv);
      if (!analyzer) return null;
      return analyzer(input);
    },
  };
}
